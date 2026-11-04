-- Escrow payments, booking lifecycle and provider wallet.
--
--   select_offer()          customer picks an agreed offer -> booking 'pending_payment', slot held 20 min
--   begin_payment()         creates a payments row + reference; the `payments` edge function opens Paystack
--   svc_confirm_payment()   called by the edge function ONLY after Paystack verifies the charge
--                           -> 'confirmed' (escrow funded): other offers close, address unlocks
--   provider_arrived()      GPS check-in within 300m            -> 'in_progress'
--   provider_mark_done()                                         -> 'awaiting_confirmation' (5h timer)
--   customer_confirm_done() or 5h timeout                        -> 'completed', 90% credited to wallet
--   cancel_booking()        before arrival only; paid bookings are refunded in full
--   request_withdrawal()    wallet -> bank via Paystack Transfers (transfer fee deducted)
--
-- Money rules: customer pays exactly the agreed price; QwikHelp keeps a flat 10% commission and absorbs
-- Paystack's collection fee out of it. Every money/state change happens here or in the edge function with
-- the service role; the app never decides that a payment succeeded.

-- ---------------------------------------------------------------------------
-- Bookings: lifecycle columns
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column payment_due_at timestamptz,
  add column funded_at timestamptz,
  add column arrived_at timestamptz,
  add column done_at timestamptz,
  add column auto_release_at timestamptz,
  add column completed_at timestamptz,
  add column released_by text check (released_by in ('customer', 'auto')),
  add column cancelled_at timestamptz,
  add column cancelled_by text check (cancelled_by in ('customer', 'provider')),
  add column cancel_reason text check (char_length(cancel_reason) <= 300),
  add column commission_amount int,
  add column provider_earning int;

alter table public.bookings drop constraint if exists bookings_payment_status_check;
alter table public.bookings add constraint bookings_payment_status_check
  check (payment_status in ('unpaid', 'paid', 'refund_pending', 'refunded', 'refund_failed'));

-- Flat 10% commission, rounded to the naira. Paystack's fee comes out of this, never the provider's share.
create or replace function private.commission_for(p_amount int)
returns int
language sql immutable set search_path = ''
as $$ select round(p_amount * 0.10)::int $$;

-- ---------------------------------------------------------------------------
-- Payments (customer -> QwikHelp, via Paystack)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  booking_id uuid references public.bookings (id) on delete set null,
  offer_id uuid not null references public.offers (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  customer_id text not null references public.profiles (id),
  amount int not null check (amount > 0), -- naira
  status text not null default 'initialized'
    check (status in ('initialized', 'success', 'failed', 'refund_pending', 'refunded', 'refund_failed')),
  paystack_transaction_id bigint,
  channel text,
  paid_at timestamptz,
  refund_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Provider wallet: ledger, payout account, withdrawals
-- ---------------------------------------------------------------------------
create table public.payout_accounts (
  provider_id text primary key references public.profiles (id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  account_number text not null check (account_number ~ '^\d{10}$'),
  account_name text not null,
  recipient_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payout_accounts_updated_at before update on public.payout_accounts
  for each row execute function public.set_updated_at();

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references public.profiles (id),
  amount int not null check (amount > 0), -- debited from the wallet
  fee int not null check (fee >= 0),      -- Paystack transfer fee, deducted
  net_amount int not null check (net_amount > 0), -- sent to the bank
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'reversed')),
  reference text not null unique,
  transfer_code text,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index withdrawals_provider_idx on public.withdrawals (provider_id, created_at desc);
create trigger withdrawals_updated_at before update on public.withdrawals
  for each row execute function public.set_updated_at();

-- Balance = sum(amount). Earnings are credited once per booking; each withdrawal debits once and is
-- credited back once if the transfer fails.
create table public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references public.profiles (id),
  kind text not null check (kind in ('earning', 'withdrawal', 'withdrawal_reversal')),
  amount int not null, -- signed naira
  booking_id uuid references public.bookings (id),
  withdrawal_id uuid references public.withdrawals (id),
  note text,
  created_at timestamptz not null default now()
);
create index wallet_entries_provider_idx on public.wallet_entries (provider_id, created_at desc);
create unique index wallet_entries_one_earning on public.wallet_entries (booking_id) where kind = 'earning';
create unique index wallet_entries_one_per_withdrawal on public.wallet_entries (withdrawal_id, kind) where withdrawal_id is not null;

-- RLS: owners can read their rows; every write goes through the functions below.
alter table public.payments enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.withdrawals enable row level security;
alter table public.wallet_entries enable row level security;
create policy "payments: own" on public.payments for select to authenticated using (customer_id = (select public.requesting_user_id()));
create policy "payout_accounts: own" on public.payout_accounts for select to authenticated using (provider_id = (select public.requesting_user_id()));
create policy "withdrawals: own" on public.withdrawals for select to authenticated using (provider_id = (select public.requesting_user_id()));
create policy "wallet_entries: own" on public.wallet_entries for select to authenticated using (provider_id = (select public.requesting_user_id()));

-- ---------------------------------------------------------------------------
-- Capacity: no overlapping jobs (with a 1-hour travel gap) and at most 3 jobs a day.
-- Unpaid holds count, so nobody else can take the slot while the customer pays.
-- ---------------------------------------------------------------------------
create or replace function private.provider_has_capacity(p_provider text, p_at timestamptz, p_hours int)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.bookings b
     where b.provider_id = p_provider
       and b.status in ('pending_payment', 'confirmed', 'en_route', 'in_progress', 'awaiting_confirmation')
       and b.scheduled_at < p_at + make_interval(hours => p_hours) + interval '1 hour'
       and b.scheduled_at + make_interval(hours => b.duration_hours) + interval '1 hour' > p_at
  ) then
    return false;
  end if;

  return (
    select count(*) from public.bookings b
     where b.provider_id = p_provider
       and b.status in ('pending_payment', 'confirmed', 'en_route', 'in_progress', 'awaiting_confirmation', 'completed')
       and (b.scheduled_at at time zone 'Africa/Lagos')::date = (p_at at time zone 'Africa/Lagos')::date
  ) < 3;
end $$;

-- ---------------------------------------------------------------------------
-- Customer: pick an agreed offer -> unpaid hold (other offers stay open until payment succeeds)
-- ---------------------------------------------------------------------------
create or replace function public.select_offer(p_offer uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  o public.offers;
  j public.jobs;
  b public.bookings;
begin
  select * into o from public.offers where id = p_offer and customer_id = uid for update;
  if not found then raise exception 'Offer not found'; end if;
  select * into j from public.jobs where id = o.job_id for update;

  if j.status <> 'open' then raise exception 'This job is no longer open'; end if;
  if o.status <> 'agreed' then raise exception 'You can only book a provider once a price is agreed'; end if;
  if exists (select 1 from public.bookings where job_id = j.id) then
    raise exception 'You already picked a provider for this job. Complete or cancel that payment first.';
  end if;

  -- The provider may have been booked elsewhere since agreeing.
  if not private.provider_has_capacity(o.provider_id, j.scheduled_at, j.duration_hours) then
    update public.offers set status = 'withdrawn' where id = p_offer;
    perform private.log_offer_event(p_offer, 'system', 'capacity_withdrawn', null, null);
    return jsonb_build_object('ok', false, 'reason', 'provider_unavailable');
  end if;

  insert into public.bookings (job_id, offer_id, customer_id, provider_id, category, agreed_amount,
                               scheduled_at, duration_hours, status, payment_due_at)
  values (j.id, o.id, o.customer_id, o.provider_id, j.category, o.amount,
          j.scheduled_at, j.duration_hours, 'pending_payment', now() + interval '20 minutes')
  returning * into b;

  update public.offers set status = 'selected', expires_at = null where id = p_offer;
  perform private.log_offer_event(p_offer, 'customer', 'select', o.amount, null);

  return jsonb_build_object('ok', true, 'booking_id', b.id, 'payment_due_at', b.payment_due_at);
end $$;

-- Drops an unpaid hold and puts the offer back (or closes it if the job is no longer open).
create or replace function private.release_hold(p_booking uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  b public.bookings;
  j public.jobs;
begin
  select * into b from public.bookings where id = p_booking and status = 'pending_payment' for update;
  if not found then return; end if;
  select * into j from public.jobs where id = b.job_id;

  delete from public.bookings where id = b.id;
  update public.offers
     set status = (case when j.status = 'open' and j.scheduled_at > now() then 'agreed' else 'job_closed' end)::public.offer_status
   where id = b.offer_id and status = 'selected';
  perform private.log_offer_event(b.offer_id, 'system', p_reason, null, null);
end $$;

create or replace function public.cancel_payment_hold(p_booking uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare uid text := private.require_uid();
begin
  if not exists (select 1 from public.bookings where id = p_booking and customer_id = uid and status = 'pending_payment') then
    raise exception 'There is no unpaid booking to cancel';
  end if;
  perform private.release_hold(p_booking, 'hold_cancelled');
end $$;

-- ---------------------------------------------------------------------------
-- Payment start: amount always comes from the booking, never from the app
-- ---------------------------------------------------------------------------
create or replace function public.begin_payment(p_booking uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  b public.bookings;
  ref text := 'qh_' || replace(gen_random_uuid()::text, '-', '');
begin
  select * into b from public.bookings where id = p_booking and customer_id = uid for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status <> 'pending_payment' then raise exception 'This booking is already paid or closed'; end if;
  if b.payment_due_at < now() then raise exception 'The payment window has closed. Please pick the provider again.'; end if;

  -- Give a little extra time once checkout starts (capped at 35 minutes after selecting).
  update public.bookings
     set payment_due_at = least(greatest(payment_due_at, now() + interval '10 minutes'), created_at + interval '35 minutes')
   where id = b.id;

  insert into public.payments (reference, booking_id, offer_id, job_id, customer_id, amount)
  values (ref, b.id, b.offer_id, b.job_id, b.customer_id, b.agreed_amount);

  return jsonb_build_object('reference', ref, 'amount', b.agreed_amount, 'booking_id', b.id);
end $$;

-- ---------------------------------------------------------------------------
-- Service role only: Paystack confirmed a charge. Idempotent.
-- result: 'funded' | 'already' | 'refund' (money must go back) | 'unknown'
-- ---------------------------------------------------------------------------
create or replace function public.svc_confirm_payment(
  p_reference text, p_amount_kobo bigint, p_transaction_id bigint, p_channel text, p_paid_at timestamptz
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  p public.payments;
  b public.bookings;
  o public.offers;
  j public.jobs;
  commission int;
begin
  select * into p from public.payments where reference = p_reference for update;
  if not found then return jsonb_build_object('result', 'unknown'); end if;
  if p.status <> 'initialized' and p.status <> 'failed' then
    return jsonb_build_object('result', 'already', 'status', p.status, 'booking_id', p.booking_id);
  end if;

  update public.payments
     set status = 'success', paystack_transaction_id = p_transaction_id, channel = p_channel, paid_at = coalesce(p_paid_at, now())
   where id = p.id;

  if p_amount_kobo <> p.amount::bigint * 100 then
    update public.payments set status = 'refund_pending', refund_reason = 'amount_mismatch' where id = p.id;
    return jsonb_build_object('result', 'refund', 'reason', 'amount_mismatch');
  end if;

  select * into b from public.bookings where id = p.booking_id for update;

  if not found then
    -- The hold lapsed while they were paying. Re-create it if the provider is still free.
    select * into o from public.offers where id = p.offer_id for update;
    select * into j from public.jobs where id = p.job_id for update;
    if o.status = 'agreed' and j.status = 'open' and j.scheduled_at > now()
       and not exists (select 1 from public.bookings where job_id = j.id)
       and private.provider_has_capacity(o.provider_id, j.scheduled_at, j.duration_hours) then
      insert into public.bookings (job_id, offer_id, customer_id, provider_id, category, agreed_amount,
                                   scheduled_at, duration_hours, status)
      values (j.id, o.id, o.customer_id, o.provider_id, j.category, o.amount, j.scheduled_at, j.duration_hours, 'pending_payment')
      returning * into b;
      update public.offers set status = 'selected', expires_at = null where id = o.id;
      update public.payments set booking_id = b.id where id = p.id;
    else
      update public.payments set status = 'refund_pending', refund_reason = 'booking_unavailable' where id = p.id;
      return jsonb_build_object('result', 'refund', 'reason', 'booking_unavailable');
    end if;
  elsif b.status <> 'pending_payment' or b.scheduled_at <= now() then
    -- Already paid by another checkout, or no longer bookable.
    update public.payments set status = 'refund_pending', refund_reason = 'duplicate_or_closed' where id = p.id;
    return jsonb_build_object('result', 'refund', 'reason', 'duplicate_or_closed');
  end if;

  commission := private.commission_for(b.agreed_amount);
  update public.bookings
     set status = 'confirmed', funded_at = now(), payment_status = 'paid', payment_reference = p.reference,
         payment_due_at = null, commission_amount = commission, provider_earning = b.agreed_amount - commission
   where id = b.id;

  update public.jobs set status = 'booked' where id = b.job_id;
  update public.offers set status = 'not_selected', expires_at = null
   where job_id = b.job_id and id <> b.offer_id and status in ('awaiting_customer', 'awaiting_provider', 'agreed');

  return jsonb_build_object('result', 'funded', 'booking_id', b.id);
end $$;

-- Service role only: Paystack refund / failure bookkeeping.
create or replace function public.svc_set_payment_status(p_reference text, p_status text, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare p public.payments;
begin
  update public.payments set status = p_status, refund_reason = coalesce(p_reason, refund_reason)
   where reference = p_reference
  returning * into p;
  if p.booking_id is not null and p_status in ('refund_pending', 'refunded', 'refund_failed') then
    update public.bookings set payment_status = p_status where id = p.booking_id and payment_reference = p_reference;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Job progress
-- ---------------------------------------------------------------------------
create or replace function public.provider_arrived(p_booking uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  b public.bookings;
  km numeric;
begin
  select * into b from public.bookings where id = p_booking and provider_id = uid for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status not in ('confirmed', 'en_route') then raise exception 'You can only check in to a paid booking that has not started'; end if;
  if now() < b.scheduled_at - interval '2 hours' then raise exception 'You can check in from 2 hours before the job starts'; end if;

  select round((extensions.st_distance(l.location,
            extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography) / 1000)::numeric, 1)
    into km
    from public.job_locations l where l.job_id = b.job_id;
  if km > 0.3 then
    raise exception 'You need to be at the job address to check in. You are about % km away.', km;
  end if;

  update public.bookings set status = 'in_progress', arrived_at = now() where id = b.id;
end $$;

create or replace function public.provider_mark_done(p_booking uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare uid text := private.require_uid();
begin
  update public.bookings
     set status = 'awaiting_confirmation', done_at = now(), auto_release_at = now() + interval '5 hours'
   where id = p_booking and provider_id = uid and status = 'in_progress';
  if not found then raise exception 'Check in at the job address before marking it done'; end if;
end $$;

-- Completes a booking and credits the provider's share. Safe to call twice.
create or replace function private.release_booking(p_booking uuid, p_by text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare b public.bookings;
begin
  update public.bookings
     set status = 'completed', completed_at = now(), released_by = p_by, auto_release_at = null,
         commission_amount = coalesce(commission_amount, private.commission_for(agreed_amount)),
         provider_earning = coalesce(provider_earning, agreed_amount - private.commission_for(agreed_amount))
   where id = p_booking and status = 'awaiting_confirmation'
  returning * into b;
  if not found then return; end if;

  if b.payment_status = 'paid' then
    insert into public.wallet_entries (provider_id, kind, amount, booking_id, note)
    values (b.provider_id, 'earning', b.provider_earning, b.id,
            private.service_name(b.category) || ' job (' || private.naira(b.agreed_amount) || ' less 10% QwikHelp fee)')
    on conflict do nothing;
  end if;
end $$;

create or replace function public.customer_confirm_done(p_booking uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare uid text := private.require_uid();
begin
  if not exists (select 1 from public.bookings where id = p_booking and customer_id = uid and status = 'awaiting_confirmation') then
    raise exception 'This job is not waiting for your confirmation';
  end if;
  perform private.release_booking(p_booking, 'customer');
end $$;

-- Either party, before the provider has arrived. Returns the refund the edge function must issue.
create or replace function public.cancel_booking(p_booking uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  b public.bookings;
  who text;
begin
  select * into b from public.bookings where id = p_booking and uid in (customer_id, provider_id) for update;
  if not found then raise exception 'Booking not found'; end if;
  who := case when uid = b.customer_id then 'customer' else 'provider' end;

  if b.status = 'pending_payment' then
    if who <> 'customer' then raise exception 'The customer has not paid yet; the booking will lapse if they don''t'; end if;
    perform private.release_hold(b.id, 'hold_cancelled');
    return jsonb_build_object('refund', false);
  end if;
  if b.status not in ('confirmed', 'en_route') then
    raise exception 'This booking can''t be cancelled in the app once the provider has arrived';
  end if;

  update public.bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = who,
         cancel_reason = nullif(left(trim(coalesce(p_reason, '')), 300), ''),
         payment_status = case when payment_status = 'paid' then 'refund_pending' else payment_status end
   where id = b.id;
  update public.jobs set status = 'cancelled' where id = b.job_id;

  if b.payment_status = 'paid' and b.payment_reference is not null then
    update public.payments set status = 'refund_pending', refund_reason = who || '_cancelled' where reference = b.payment_reference;
    return jsonb_build_object('refund', true, 'reference', b.payment_reference, 'amount', b.agreed_amount);
  end if;
  return jsonb_build_object('refund', false);
end $$;

-- The customer cancelling the whole request also drops an unpaid hold.
create or replace function public.cancel_job(p_job uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  hold uuid;
begin
  select id into hold from public.bookings where job_id = p_job and customer_id = uid and status = 'pending_payment';
  if hold is not null then perform private.release_hold(hold, 'hold_cancelled'); end if;

  update public.jobs set status = 'cancelled' where id = p_job and customer_id = uid and status = 'open';
  if not found then raise exception 'This job can no longer be cancelled'; end if;
  update public.offers set status = 'job_closed', expires_at = null
   where job_id = p_job and status in ('awaiting_customer', 'awaiting_provider', 'agreed', 'selected');
end $$;

-- ---------------------------------------------------------------------------
-- Wallet
-- ---------------------------------------------------------------------------
create or replace function private.transfer_fee(p_amount int)
returns int
language sql immutable set search_path = ''
as $$ select case when p_amount <= 5000 then 10 when p_amount <= 50000 then 25 else 50 end $$;

create or replace function public.get_my_uid()
returns text
language sql stable security definer set search_path = ''
as $$ select private.require_uid() $$;

create or replace function public.get_wallet()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare uid text := private.require_uid();
begin
  return jsonb_build_object(
    'available', coalesce((select sum(amount) from public.wallet_entries where provider_id = uid), 0),
    'in_escrow', coalesce((select sum(coalesce(provider_earning, agreed_amount - private.commission_for(agreed_amount)))
                             from public.bookings where provider_id = uid and payment_status = 'paid'
                              and status in ('confirmed', 'en_route', 'in_progress', 'awaiting_confirmation')), 0),
    'total_earned', coalesce((select sum(amount) from public.wallet_entries where provider_id = uid and kind = 'earning'), 0),
    'commission_rate', 10,
    'min_withdrawal', 1000,
    'account', (select jsonb_build_object('bank_name', bank_name, 'account_name', account_name,
                                          'account_last4', right(account_number, 4))
                  from public.payout_accounts where provider_id = uid),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'amount', amount, 'note', note,
                                                             'booking_id', booking_id, 'withdrawal_id', withdrawal_id, 'created_at', created_at) order by created_at desc)
                           from (select * from public.wallet_entries where provider_id = uid order by created_at desc limit 50) e), '[]'::jsonb),
    'withdrawals', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'amount', amount, 'fee', fee, 'net_amount', net_amount,
                                                                 'status', status, 'bank_name', bank_name,
                                                                 'account_last4', right(account_number, 4),
                                                                 'failure_reason', failure_reason, 'created_at', created_at) order by created_at desc)
                               from (select * from public.withdrawals where provider_id = uid order by created_at desc limit 20) w), '[]'::jsonb)
  );
end $$;

-- Service role only: the edge function verified the account with Paystack and created a transfer recipient.
create or replace function public.svc_save_payout_account(
  p_uid text, p_bank_code text, p_bank_name text, p_account_number text, p_account_name text, p_recipient_code text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.provider_profiles where user_id = p_uid) then
    raise exception 'Only providers can add a payout account';
  end if;
  insert into public.payout_accounts (provider_id, bank_code, bank_name, account_number, account_name, recipient_code)
  values (p_uid, p_bank_code, p_bank_name, p_account_number, p_account_name, p_recipient_code)
  on conflict (provider_id) do update
    set bank_code = excluded.bank_code, bank_name = excluded.bank_name, account_number = excluded.account_number,
        account_name = excluded.account_name, recipient_code = excluded.recipient_code;
end $$;

-- Debits the wallet up front; the edge function then starts the Paystack transfer.
create or replace function public.request_withdrawal(p_amount int)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  acct public.payout_accounts;
  balance int;
  fee int;
  w public.withdrawals;
begin
  perform pg_advisory_xact_lock(hashtext('wallet:' || uid));

  select * into acct from public.payout_accounts where provider_id = uid;
  if not found then raise exception 'Add a bank account before withdrawing'; end if;
  if p_amount is null or p_amount < 1000 then raise exception 'The minimum withdrawal is ₦1,000'; end if;
  if exists (select 1 from public.withdrawals where provider_id = uid and status = 'pending') then
    raise exception 'You already have a withdrawal in progress';
  end if;

  select coalesce(sum(amount), 0) into balance from public.wallet_entries where provider_id = uid;
  if p_amount > balance then raise exception 'You can withdraw up to %', private.naira(balance); end if;

  fee := private.transfer_fee(p_amount);
  insert into public.withdrawals (provider_id, amount, fee, net_amount, reference, bank_name, account_number, account_name)
  values (uid, p_amount, fee, p_amount - fee, 'qhw_' || replace(gen_random_uuid()::text, '-', ''),
          acct.bank_name, acct.account_number, acct.account_name)
  returning * into w;

  insert into public.wallet_entries (provider_id, kind, amount, withdrawal_id, note)
  values (uid, 'withdrawal', -p_amount, w.id, 'Withdrawal to ' || acct.bank_name || ' ••' || right(acct.account_number, 4));

  return jsonb_build_object('withdrawal_id', w.id, 'reference', w.reference, 'net_amount', w.net_amount,
                            'fee', w.fee, 'recipient_code', acct.recipient_code);
end $$;

-- Service role only: transfer outcome. Failed/reversed transfers credit the money back once.
create or replace function public.svc_withdrawal_result(p_reference text, p_status text, p_transfer_code text default null, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare w public.withdrawals;
begin
  update public.withdrawals
     set status = p_status, transfer_code = coalesce(p_transfer_code, transfer_code), failure_reason = coalesce(p_reason, failure_reason)
   where reference = p_reference and status = 'pending'
  returning * into w;
  if not found then return; end if;

  if p_status in ('failed', 'reversed') then
    insert into public.wallet_entries (provider_id, kind, amount, withdrawal_id, note)
    values (w.provider_id, 'withdrawal_reversal', w.amount, w.id, 'Withdrawal returned: ' || coalesce(p_reason, p_status))
    on conflict do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------
create or replace function private.booking_json(b public.bookings, uid text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  j public.jobs;
  l public.job_locations;
  is_customer boolean := uid = b.customer_id;
  -- Providers get the exact address only once the escrow is funded.
  reveal boolean := is_customer or b.status in ('confirmed', 'en_route', 'in_progress', 'awaiting_confirmation');
begin
  select * into j from public.jobs where id = b.job_id;
  select * into l from public.job_locations where job_id = b.job_id;
  return jsonb_build_object(
    'id', b.id, 'job_id', b.job_id, 'offer_id', b.offer_id, 'status', b.status,
    'agreed_amount', b.agreed_amount, 'scheduled_at', b.scheduled_at, 'duration_hours', b.duration_hours,
    'category', b.category, 'description', j.description, 'landmark', j.landmark,
    'payment_status', b.payment_status, 'payment_due_at', b.payment_due_at, 'funded_at', b.funded_at,
    'arrived_at', b.arrived_at, 'done_at', b.done_at, 'auto_release_at', b.auto_release_at,
    'completed_at', b.completed_at, 'released_by', b.released_by,
    'cancelled_by', b.cancelled_by, 'cancel_reason', b.cancel_reason,
    'commission_amount', coalesce(b.commission_amount, private.commission_for(b.agreed_amount)),
    'provider_earning', coalesce(b.provider_earning, b.agreed_amount - private.commission_for(b.agreed_amount)),
    'address', case when reveal then l.address end,
    'lat', case when reveal then l.lat end,
    'lng', case when reveal then l.lng end,
    'role', case when is_customer then 'customer' else 'provider' end,
    'customer_name', private.first_name((select full_name from public.profiles where id = b.customer_id)),
    'provider', private.provider_card(b.provider_id)
  );
end $$;

create or replace function public.get_my_bookings()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare uid text := private.require_uid();
begin
  return coalesce((
    select jsonb_agg(private.booking_json(b, uid) order by b.scheduled_at desc)
      from public.bookings b
     where uid in (b.customer_id, b.provider_id)
  ), '[]'::jsonb);
end $$;

create or replace function public.get_booking(p_booking uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking and uid in (customer_id, provider_id);
  if not found then raise exception 'Booking not found'; end if;
  return private.booking_json(b, uid);
end $$;

-- ---------------------------------------------------------------------------
-- Chat: an unpaid hold keeps the chat at 'open' (text only); photos once paid.
-- ---------------------------------------------------------------------------
create or replace function private.conversation_state(p_conversation uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  o public.offers;
  b public.bookings;
begin
  select o2.* into o
    from public.conversations c join public.offers o2 on o2.id = c.offer_id
   where c.id = p_conversation;
  if not found then return 'closed'; end if;

  if o.status = 'agreed' then return 'open'; end if;
  if o.status <> 'selected' then return 'closed'; end if;

  select * into b from public.bookings where offer_id = o.id;
  if not found or b.status = 'pending_payment' then return 'open'; end if;
  if b.status in ('completed', 'cancelled')
     and greatest(b.updated_at, b.scheduled_at + make_interval(hours => b.duration_hours)) < now() - interval '3 days' then
    return 'closed';
  end if;
  return 'booked';
end $$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create or replace function private.notify_offer_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  j public.jobs;
  service text;
  provider_name text;
  to_customer jsonb;
  to_provider jsonb;
begin
  if tg_op = 'UPDATE' and new.status = old.status then return new; end if;

  select * into j from public.jobs where id = new.job_id;
  service := private.service_name(j.category);
  provider_name := private.person_first_name(new.provider_id);
  to_customer := jsonb_build_object('url', '/booking/offers/' || new.job_id, 'jobId', new.job_id, 'offerId', new.id);
  to_provider := jsonb_build_object('url', '/request/' || new.job_id, 'jobId', new.job_id, 'offerId', new.id);

  if tg_op = 'INSERT' then
    if new.status = 'agreed' then
      perform private.notify(new.customer_id, 'offer_agreed', provider_name || ' accepted your price',
        provider_name || ' will do your ' || lower(service) || ' job for ' || private.naira(new.amount) || '. Review and book.', to_customer);
    elsif new.status = 'awaiting_customer' then
      perform private.notify(new.customer_id, 'offer_counter', 'New offer from ' || provider_name,
        provider_name || ' offered ' || private.naira(new.amount) || ' for your ' || lower(service) || ' job. Respond within 30 minutes.',
        jsonb_build_object('url', '/booking/bargain/' || new.id, 'jobId', new.job_id, 'offerId', new.id));
    end if;
    return new;
  end if;

  case new.status
    when 'awaiting_provider' then
      perform private.notify(new.provider_id, 'offer_final_counter', 'Final offer: ' || private.naira(new.amount),
        'The customer sent a final offer for the ' || lower(service) || ' job. Respond within 30 minutes.', to_provider);
    when 'agreed' then
      if old.status = 'selected' then
        perform private.notify(new.provider_id, 'payment_lapsed', 'Booking not completed',
          'The customer didn''t finish paying for the ' || lower(service) || ' job. They may still book you.', to_provider);
      elsif old.status = 'awaiting_customer' then
        perform private.notify(new.provider_id, 'offer_agreed', 'Your offer was accepted',
          'The customer accepted ' || private.naira(new.amount) || '. You''ll be notified if they book you.', to_provider);
      else
        perform private.notify(new.customer_id, 'offer_agreed', provider_name || ' accepted your offer',
          provider_name || ' agreed to ' || private.naira(new.amount) || '. Review and book.', to_customer);
      end if;
    when 'declined' then
      perform private.notify(new.provider_id, 'offer_declined', 'Offer declined',
        'The customer declined your offer for the ' || lower(service) || ' job.', to_provider);
    when 'walked_away' then
      perform private.notify(new.customer_id, 'offer_walked_away', provider_name || ' declined your final offer',
        'Other providers may still respond to your ' || lower(service) || ' job.', to_customer);
    when 'expired' then
      if old.status = 'awaiting_customer' then
        perform private.notify(new.provider_id, 'offer_expired', 'Offer expired',
          'The customer didn''t respond to your offer in time.', to_provider);
      elsif old.status = 'awaiting_provider' then
        perform private.notify(new.customer_id, 'offer_expired', 'Offer expired',
          provider_name || ' didn''t respond to your final offer in time.', to_customer);
      end if;
    when 'withdrawn' then
      if old.status = 'agreed' then
        perform private.notify(new.customer_id, 'offer_withdrawn', provider_name || ' is no longer available',
          provider_name || ' withdrew from your ' || lower(service) || ' job.', to_customer);
      end if;
    when 'selected' then
      perform private.notify(new.provider_id, 'offer_selected', 'The customer picked you!',
        'They''re paying for the ' || lower(service) || ' job now. You''ll be notified once it''s confirmed.',
        jsonb_build_object('url', '/(provider-tabs)/jobs', 'jobId', new.job_id));
    when 'not_selected' then
      perform private.notify(new.provider_id, 'offer_not_selected', 'Customer chose another provider',
        'The ' || lower(service) || ' job near ' || j.landmark || ' was booked by someone else.', to_provider);
    else
      null;
  end case;
  return new;
end $$;

create or replace function private.notify_booking_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  provider_name text := private.person_first_name(new.provider_id);
  service text := lower(private.service_name(new.category));
  when_text text := to_char(new.scheduled_at at time zone 'Africa/Lagos', 'Dy DD Mon, HH12:MI AM');
  to_customer jsonb := jsonb_build_object('url', '/(customer-tabs)/history', 'bookingId', new.id);
  to_provider jsonb := jsonb_build_object('url', '/(provider-tabs)/jobs', 'bookingId', new.id);
  refund_text text := case when new.payment_status = 'refund_pending' then ' Your ' || private.naira(new.agreed_amount) || ' is being refunded in full.' else '' end;
  reason_text text := case when new.cancel_reason is not null then ' Reason: ' || new.cancel_reason || '.' else '' end;
begin
  if new.status = old.status then return new; end if;
  case new.status
    when 'confirmed' then
      perform private.notify(new.provider_id, 'booking_confirmed', 'You''ve been booked!',
        'Your ' || service || ' job on ' || when_text || ' is paid. ' || private.naira(new.provider_earning)
          || ' is held for you. The address is now in your Jobs tab.', to_provider);
      perform private.notify(new.customer_id, 'payment_received', 'Payment received',
        private.naira(new.agreed_amount) || ' is held safely by QwikHelp until you confirm the job is done.', to_customer);
    when 'en_route' then
      perform private.notify(new.customer_id, 'provider_on_the_way', provider_name || ' is on the way', 'Your ' || service || ' provider is heading to you.', to_customer);
    when 'in_progress' then
      perform private.notify(new.customer_id, 'provider_arrived', provider_name || ' has arrived', provider_name || ' checked in at your address for the ' || service || ' job.', to_customer);
    when 'awaiting_confirmation' then
      perform private.notify(new.customer_id, 'confirm_job_done', 'Is the job done?',
        provider_name || ' marked your ' || service || ' job as done. Please confirm within 5 hours to release payment.', to_customer);
    when 'completed' then
      perform private.notify(new.provider_id, 'payment_released', private.naira(new.provider_earning) || ' added to your wallet',
        case when new.released_by = 'auto' then 'The customer didn''t respond within 5 hours, so payment was released automatically.'
             else 'The customer confirmed the job is done.' end,
        jsonb_build_object('url', '/(provider-tabs)/earnings', 'bookingId', new.id));
      perform private.notify(new.customer_id, 'service_completed', 'Service completed', 'How did ' || provider_name || ' do? Rate your ' || service || ' service.', to_customer);
    when 'cancelled' then
      if new.cancelled_by = 'provider' then
        perform private.notify(new.customer_id, 'booking_cancelled', provider_name || ' cancelled your booking',
          'Your ' || service || ' booking was cancelled.' || reason_text || refund_text, to_customer);
        perform private.notify(new.provider_id, 'booking_cancelled', 'Booking cancelled', 'You cancelled the ' || service || ' booking.', to_provider);
      else
        perform private.notify(new.provider_id, 'booking_cancelled', 'Booking cancelled',
          'The customer cancelled the ' || service || ' booking on ' || when_text || '.' || reason_text, to_provider);
        perform private.notify(new.customer_id, 'booking_cancelled', 'Booking cancelled', 'Your ' || service || ' booking was cancelled.' || refund_text, to_customer);
      end if;
    else
      null;
  end case;
  return new;
end $$;

-- Refund / withdrawal outcomes.
create or replace function private.notify_payment_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = old.status then return new; end if;
  if new.status = 'refunded' then
    perform private.notify(new.customer_id, 'refund_completed', 'Refund sent',
      private.naira(new.amount) || ' has been refunded to your original payment method.', jsonb_build_object('url', '/(customer-tabs)/history'));
  elsif new.status = 'refund_pending' and new.refund_reason in ('booking_unavailable', 'duplicate_or_closed', 'amount_mismatch') then
    perform private.notify(new.customer_id, 'refund_started', 'Payment couldn''t be used',
      'The booking was no longer available, so your ' || private.naira(new.amount) || ' is being refunded in full.', jsonb_build_object('url', '/(customer-tabs)/history'));
  end if;
  return new;
end $$;
create trigger payments_notify after update of status on public.payments
  for each row execute function private.notify_payment_change();

create or replace function private.notify_withdrawal_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare data jsonb := jsonb_build_object('url', '/(provider-tabs)/earnings');
begin
  if new.status = old.status then return new; end if;
  if new.status = 'success' then
    perform private.notify(new.provider_id, 'withdrawal_success', 'Withdrawal sent', private.naira(new.net_amount) || ' is on its way to ' || new.bank_name || '.', data);
  elsif new.status in ('failed', 'reversed') then
    perform private.notify(new.provider_id, 'withdrawal_failed', 'Withdrawal failed', private.naira(new.amount) || ' has been returned to your wallet.', data);
  end if;
  return new;
end $$;
create trigger withdrawals_notify after update of status on public.withdrawals
  for each row execute function private.notify_withdrawal_change();

-- ---------------------------------------------------------------------------
-- Timers (every minute): lapsed payment holds and 5-hour auto-release
-- ---------------------------------------------------------------------------
create or replace function private.payment_sweep()
returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  for r in select id, customer_id, category from public.bookings where status = 'pending_payment' and payment_due_at < now() loop
    perform private.release_hold(r.id, 'payment_window_expired');
    perform private.notify(r.customer_id, 'payment_window_expired', 'Payment window closed',
      'Your ' || lower(private.service_name(r.category)) || ' booking wasn''t paid in time. You can pick a provider again from your offers.',
      jsonb_build_object('url', '/(customer-tabs)/history'));
  end loop;

  for r in select id from public.bookings where status = 'awaiting_confirmation' and auto_release_at < now() loop
    perform private.release_booking(r.id, 'auto');
  end loop;
end $$;

select cron.schedule('qwikhelp-payment-sweep', '* * * * *', $$select private.payment_sweep()$$);

-- Jobs with an unpaid hold don't expire mid-payment.
create or replace function private.broadcast_sweep()
returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  update public.offers set status = 'expired', expires_at = null
   where status in ('awaiting_customer', 'awaiting_provider') and expires_at < now();

  update public.jobs j set status = 'expired'
   where j.status = 'open' and j.expires_at < now()
     and not exists (select 1 from public.bookings b where b.job_id = j.id and b.status = 'pending_payment');

  update public.offers o set status = 'job_closed', expires_at = null
    from public.jobs j
   where j.id = o.job_id and j.status in ('expired', 'cancelled')
     and o.status in ('awaiting_customer', 'awaiting_provider', 'agreed');

  for r in select id, search_radius_km, created_at from public.jobs where status = 'open' loop
    -- Widen to 5km if nobody has responded within 10 minutes.
    if r.search_radius_km < 5 and r.created_at < now() - interval '10 minutes'
       and not exists (select 1 from public.offers where job_id = r.id) then
      perform private.dispatch_job(r.id, 5);
    else
      -- Providers who came online since the last pass.
      perform private.dispatch_job(r.id, r.search_radius_km);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.cancel_payment_hold(uuid),
  public.begin_payment(uuid),
  public.provider_arrived(uuid, double precision, double precision),
  public.provider_mark_done(uuid),
  public.customer_confirm_done(uuid),
  public.cancel_booking(uuid, text),
  public.get_my_uid(),
  public.get_wallet(),
  public.request_withdrawal(int),
  public.get_booking(uuid),
  public.svc_confirm_payment(text, bigint, bigint, text, timestamptz),
  public.svc_set_payment_status(text, text, text),
  public.svc_save_payout_account(text, text, text, text, text, text),
  public.svc_withdrawal_result(text, text, text, text)
from public, anon;

grant execute on function
  public.cancel_payment_hold(uuid),
  public.begin_payment(uuid),
  public.provider_arrived(uuid, double precision, double precision),
  public.provider_mark_done(uuid),
  public.customer_confirm_done(uuid),
  public.cancel_booking(uuid, text),
  public.get_my_uid(),
  public.get_wallet(),
  public.request_withdrawal(int),
  public.get_booking(uuid)
to authenticated;

-- Only the payments edge function (service role) may record Paystack outcomes.
revoke execute on function
  public.svc_confirm_payment(text, bigint, bigint, text, timestamptz),
  public.svc_set_payment_status(text, text, text),
  public.svc_save_payout_account(text, text, text, text, text, text),
  public.svc_withdrawal_result(text, text, text, text)
from authenticated;
grant execute on function
  public.svc_confirm_payment(text, bigint, bigint, text, timestamptz),
  public.svc_set_payment_status(text, text, text),
  public.svc_save_payout_account(text, text, text, text, text, text),
  public.svc_withdrawal_result(text, text, text, text)
to service_role;

alter publication supabase_realtime add table public.payments, public.wallet_entries, public.withdrawals;
