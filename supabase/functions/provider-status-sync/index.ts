// Mirrors a provider's status (public.provider_profiles.status) into Clerk publicMetadata, which the
// app's routing gate reads. Two callers:
//   1. Database trigger on status change  -> x-webhook-secret header; also sends a push notification.
//   2. The provider's app (self-sync)      -> Authorization: Bearer <Clerk session token>. Recovers from a
//      missed webhook. The status is always read from the database, never taken from the request.
import { verifyToken } from 'npm:@clerk/backend@2';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CLERK_SECRET_KEY = Deno.env.get('CLERK_SECRET_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('PROVIDER_STATUS_WEBHOOK_SECRET')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const PUSH_COPY: Record<string, { title: string; body: string } | undefined> = {
  approved: { title: "You're verified!", body: 'Your provider account is approved. Go online to start receiving jobs.' },
  needs_changes: { title: 'Action needed', body: 'Some of your verification details need updating.' },
  rejected: { title: 'Verification unsuccessful', body: 'We could not verify your provider account.' },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function setClerkStatus(userId: string, status: string) {
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_metadata: { providerStatus: status } }),
  });
  if (!res.ok) throw new Error(`Clerk metadata update failed: ${res.status} ${await res.text()}`);
}

async function sendPush(userId: string, status: string) {
  const copy = PUSH_COPY[status];
  if (!copy) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('expo_push_token')
    .eq('id', userId)
    .single();
  if (!profile?.expo_push_token) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: profile.expo_push_token, ...copy, data: { type: 'provider_status', status } }),
  });
}

async function handleWebhook(req: Request) {
  const { type, record, old_record } = await req.json();
  if (type !== 'UPDATE' || record.status === old_record?.status) return json({ ignored: true });

  await setClerkStatus(record.user_id, record.status);
  await sendPush(record.user_id, record.status);
  return json({ ok: true });
}

async function handleSelfSync(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  if (!CLERK_SECRET_KEY?.startsWith('sk_')) {
    return json({ error: 'Server misconfigured: CLERK_SECRET_KEY is not a Clerk secret key (sk_...)' }, 500);
  }

  let userId: string;
  try {
    // Depending on the SDK version this either throws or returns { data, errors }.
    const result: any = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    if (result?.errors?.length) throw result.errors[0];
    userId = (result?.data ?? result)?.sub;
    if (!userId) throw new Error('token has no subject');
  } catch (err: any) {
    console.error('Clerk token verification failed', err);
    const reason = err?.reason || err?.message || 'unknown';
    return json({ error: `Unauthorized: invalid session token (${reason})` }, 401);
  }

  const { data: provider, error } = await supabase
    .from('provider_profiles')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!provider) return json({ error: 'Provider profile not found' }, 404);

  await setClerkStatus(userId, provider.status);
  return json({ status: provider.status });
}

Deno.serve(async (req) => {
  try {
    if (req.headers.has('x-webhook-secret')) {
      if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
        return json({ error: 'Unauthorized' }, 401);
      }
      return await handleWebhook(req);
    }
    return await handleSelfSync(req);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : 'Sync failed' }, 502);
  }
});
