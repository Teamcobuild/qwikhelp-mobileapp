// Paystack integration: escrow collection, refunds, provider payouts.
//
// App calls (POST, Authorization: Bearer <Clerk session token>, body { action, ... }):
//   init         { booking_id, email }            -> { authorization_url, reference }
//   verify       { reference }                    -> { result, booking_id }
//   cancel       { booking_id, reason }           -> { refund }
//   banks                                         -> { banks }
//   resolve      { account_number, bank_code }    -> { account_name }
//   save_account { account_number, bank_code }    -> { ok }
//   withdraw     { amount }                       -> { status }
// Paystack calls:
//   POST /payments/webhook   (x-paystack-signature, HMAC-SHA512 of the raw body with the secret key)
//   GET  /payments/callback  (browser lands here after checkout, bounced back into the app)
//
// The user's own Clerk token is forwarded to Postgres, so every RPC runs as that user and enforces its
// own rules. Only Paystack-verified outcomes are written with the service role (svc_* functions).
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/payments/callback`;
// Deep link the app's checkout browser session is waiting for (expo-web-browser).
const APP_RETURN_URL = 'qwikhelp://payment-complete';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

class UserError extends Error {}

async function paystack<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status === false) {
    throw new UserError(body.message || `Paystack error (${res.status})`);
  }
  return body.data as T;
}

// Runs RPCs as the calling user; Postgres rejects the token if it isn't a valid Clerk session.
function userClient(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth) throw new UserError('Not signed in');
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function rpc<T = any>(client: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new UserError(error.message);
  return data as T;
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------
async function init(req: Request, body: any) {
  const user = userClient(req);
  const email = String(body.email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError('A valid email is needed for your receipt');

  const started = await rpc(user, 'begin_payment', { p_booking: body.booking_id });
  const tx = await paystack<{ authorization_url: string; reference: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: started.amount * 100, // kobo
      currency: 'NGN',
      reference: started.reference,
      callback_url: CALLBACK_URL,
      channels: ['card', 'bank', 'ussd', 'bank_transfer'],
      metadata: { booking_id: started.booking_id, cancel_action: `${CALLBACK_URL}?cancelled=1` },
    }),
  });
  return json({ authorization_url: tx.authorization_url, reference: started.reference });
}

// Refunds the full charge. Paystack confirms asynchronously (refund.processed webhook).
async function refund(reference: string, reason: string) {
  try {
    await paystack('/refund', { method: 'POST', body: JSON.stringify({ transaction: reference, merchant_note: reason }) });
    await rpc(admin, 'svc_set_payment_status', { p_reference: reference, p_status: 'refund_pending', p_reason: reason });
  } catch (err) {
    console.error('refund failed', reference, err);
    await rpc(admin, 'svc_set_payment_status', { p_reference: reference, p_status: 'refund_failed', p_reason: String(err) });
  }
}

// Verifies a charge with Paystack and records it. Used by the app after checkout and by the webhook.
async function confirmCharge(reference: string) {
  const tx = await paystack<any>(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (tx.status !== 'success') {
    return { result: tx.status === 'abandoned' || tx.status === 'ongoing' || tx.status === 'pending' ? 'pending' : 'failed' };
  }
  const outcome = await rpc(admin, 'svc_confirm_payment', {
    p_reference: reference,
    p_amount_kobo: tx.amount,
    p_transaction_id: tx.id,
    p_channel: tx.channel,
    p_paid_at: tx.paid_at,
  });
  if (outcome.result === 'refund') await refund(reference, outcome.reason ?? 'booking_unavailable');
  return outcome;
}

async function verify(req: Request, body: any) {
  // Only the payer may poll their own payment.
  const user = userClient(req);
  const { data: payment, error } = await user.from('payments').select('reference').eq('reference', body.reference).maybeSingle();
  if (error || !payment) throw new UserError('Payment not found');
  return json(await confirmCharge(body.reference));
}

// ---------------------------------------------------------------------------
// Cancellation (refund if paid)
// ---------------------------------------------------------------------------
async function cancel(req: Request, body: any) {
  const user = userClient(req);
  const result = await rpc(user, 'cancel_booking', { p_booking: body.booking_id, p_reason: body.reason ?? null });
  if (result.refund) await refund(result.reference, 'booking_cancelled');
  return json({ refund: !!result.refund });
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------
let bankCache: { at: number; banks: { name: string; code: string }[] } | null = null;

async function banks() {
  if (!bankCache || Date.now() - bankCache.at > 6 * 60 * 60 * 1000) {
    const list = await paystack<any[]>('/bank?country=nigeria&currency=NGN&perPage=200');
    bankCache = {
      at: Date.now(),
      banks: list.filter((b) => b.active && !b.is_deleted).map((b) => ({ name: b.name, code: b.code })),
    };
  }
  return json({ banks: bankCache.banks });
}

async function resolveAccount(accountNumber: string, bankCode: string) {
  if (!/^\d{10}$/.test(accountNumber)) throw new UserError('Account numbers are 10 digits');
  const data = await paystack<{ account_name: string }>(
    `/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`,
  );
  return data.account_name;
}

async function resolve(req: Request, body: any) {
  await rpc(userClient(req), 'get_my_uid'); // signed-in users only
  return json({ account_name: await resolveAccount(String(body.account_number ?? ''), String(body.bank_code ?? '')) });
}

async function saveAccount(req: Request, body: any) {
  const uid = await rpc<string>(userClient(req), 'get_my_uid');
  const accountNumber = String(body.account_number ?? '');
  const bankCode = String(body.bank_code ?? '');
  const accountName = await resolveAccount(accountNumber, bankCode);
  const bank = (await (await banks()).json()).banks.find((b: any) => b.code === bankCode);
  if (!bank) throw new UserError('Unknown bank');

  const recipient = await paystack<{ recipient_code: string }>('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({ type: 'nuban', name: accountName, account_number: accountNumber, bank_code: bankCode, currency: 'NGN' }),
  });
  await rpc(admin, 'svc_save_payout_account', {
    p_uid: uid, p_bank_code: bankCode, p_bank_name: bank.name, p_account_number: accountNumber,
    p_account_name: accountName, p_recipient_code: recipient.recipient_code,
  });
  return json({ ok: true, account_name: accountName, bank_name: bank.name });
}

async function withdraw(req: Request, body: any) {
  const w = await rpc(userClient(req), 'request_withdrawal', { p_amount: Math.floor(Number(body.amount)) });
  try {
    const transfer = await paystack<{ transfer_code: string; status: string }>('/transfer', {
      method: 'POST',
      body: JSON.stringify({
        source: 'balance',
        amount: w.net_amount * 100,
        recipient: w.recipient_code,
        reference: w.reference,
        reason: 'QwikHelp earnings',
      }),
    });
    if (transfer.status === 'success') {
      await rpc(admin, 'svc_withdrawal_result', { p_reference: w.reference, p_status: 'success', p_transfer_code: transfer.transfer_code });
    } else if (transfer.status === 'failed' || transfer.status === 'reversed') {
      await rpc(admin, 'svc_withdrawal_result', { p_reference: w.reference, p_status: transfer.status, p_transfer_code: transfer.transfer_code });
    }
    // 'pending' / 'otp': final outcome arrives via the transfer.* webhook.
    return json({ status: transfer.status });
  } catch (err) {
    await rpc(admin, 'svc_withdrawal_result', { p_reference: w.reference, p_status: 'failed', p_reason: String((err as Error).message) });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Paystack → us
// ---------------------------------------------------------------------------
async function hmacSha512Hex(key: string, message: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function webhook(req: Request) {
  const raw = await req.text();
  const expected = await hmacSha512Hex(PAYSTACK_SECRET_KEY, raw);
  if (req.headers.get('x-paystack-signature') !== expected) return json({ error: 'bad signature' }, 401);

  const { event, data } = JSON.parse(raw);
  switch (event) {
    case 'charge.success':
      // Re-verify with Paystack rather than trusting the payload.
      await confirmCharge(data.reference);
      break;
    case 'refund.processed':
      await rpc(admin, 'svc_set_payment_status', { p_reference: data.transaction_reference, p_status: 'refunded' });
      break;
    case 'refund.failed':
      await rpc(admin, 'svc_set_payment_status', { p_reference: data.transaction_reference, p_status: 'refund_failed', p_reason: 'refund.failed' });
      break;
    case 'transfer.success':
    case 'transfer.failed':
    case 'transfer.reversed':
      await rpc(admin, 'svc_withdrawal_result', {
        p_reference: data.reference,
        p_status: event.split('.')[1],
        p_transfer_code: data.transfer_code,
        p_reason: data.reason ?? null,
      });
      break;
  }
  return json({ ok: true });
}

// The checkout browser lands here; send it back into the app (openAuthSessionAsync is waiting for this URL).
function callback(url: URL) {
  const params = new URLSearchParams();
  const reference = url.searchParams.get('reference') ?? url.searchParams.get('trxref');
  if (reference) params.set('reference', reference);
  if (url.searchParams.get('cancelled')) params.set('cancelled', '1');
  const location = `${APP_RETURN_URL}?${params}`;
  return new Response(
    `<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;text-align:center;padding:48px">
     <p>Returning to QwikHelp…</p><p><a href="${location}">Tap here if nothing happens</a></p>
     <script>location.replace(${JSON.stringify(location)})</script>`,
    { status: 302, headers: { Location: location, 'Content-Type': 'text/html' } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (!PAYSTACK_SECRET_KEY.startsWith('sk_')) return json({ error: 'Server misconfigured: PAYSTACK_SECRET_KEY is not set' }, 500);

  try {
    if (url.pathname.endsWith('/webhook')) return await webhook(req);
    if (url.pathname.endsWith('/callback')) return callback(url);
    if (req.method !== 'POST') return json({ error: 'Not found' }, 404);

    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case 'init': return await init(req, body);
      case 'verify': return await verify(req, body);
      case 'cancel': return await cancel(req, body);
      case 'banks': await rpc(userClient(req), 'get_my_uid'); return await banks();
      case 'resolve': return await resolve(req, body);
      case 'save_account': return await saveAccount(req, body);
      case 'withdraw': return await withdraw(req, body);
      default: return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
