-- In-app notifications + Expo push.
-- Every notification is a row in public.notifications (the in-app list). Inserting a row sends an Expo
-- push to the user's device when they have a push token. Rows are created only by the triggers below,
-- which watch the marketplace tables, so the RPCs that drive the negotiation stay unchanged.
-- Optional Vault secret: expo_access_token (only needed if "Enhanced push security" is on in Expo).

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}',   -- { url: in-app route to open on tap, ...ids }
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = public.requesting_user_id());
create policy "notifications: mark own read" on public.notifications
  for update to authenticated
  using (user_id = public.requesting_user_id()) with check (user_id = public.requesting_user_id());

revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- Push tokens. One device belongs to one account at a time, so registering a token
-- removes it from any other profile (account switching on a shared phone).
-- ---------------------------------------------------------------------------
create or replace function public.register_push_token(p_token text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
begin
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Invalid push token';
  end if;
  update public.profiles set expo_push_token = null where expo_push_token = p_token and id <> uid;
  update public.profiles set expo_push_token = p_token where id = uid;
end $$;

create or replace function public.clear_push_token()
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles set expo_push_token = null where id = public.requesting_user_id();
$$;

revoke execute on function public.register_push_token(text) from public, anon;
revoke execute on function public.clear_push_token() from public, anon;
grant execute on function public.register_push_token(text) to authenticated;
grant execute on function public.clear_push_token() to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.notify(p_user text, p_type text, p_title text, p_body text, p_data jsonb default '{}')
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user, p_type, p_title, p_body, coalesce(p_data, '{}'));
$$;

create or replace function private.naira(p_amount int)
returns text
language sql immutable
as $$ select '₦' || to_char(p_amount, 'FM999,999,999') $$;

create or replace function private.service_name(p_category text)
returns text
language sql stable security definer set search_path = ''
as $$ select coalesce((select name from public.service_categories where id = p_category), p_category) $$;

create or replace function private.person_first_name(p_user text)
returns text
language sql stable security definer set search_path = ''
as $$ select coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Someone') from public.profiles where id = p_user $$;

-- ---------------------------------------------------------------------------
-- Push delivery
-- ---------------------------------------------------------------------------
create or replace function private.send_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  token text;
  access_token text;
  headers jsonb := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json');
begin
  select expo_push_token into token from public.profiles where id = new.user_id;
  if token is null then return new; end if;

  select decrypted_secret into access_token from vault.decrypted_secrets where name = 'expo_access_token';
  if access_token is not null then
    headers := headers || jsonb_build_object('Authorization', 'Bearer ' || access_token);
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := jsonb_build_object(
      'to', token,
      'title', new.title,
      'body', new.body,
      'sound', 'default',
      'channelId', 'default',
      'data', new.data || jsonb_build_object('notificationId', new.id, 'type', new.type)
    ),
    headers := headers
  );
  return new;
end $$;

create trigger notifications_send_push after insert on public.notifications
  for each row execute function private.send_push();

-- ---------------------------------------------------------------------------
-- Event triggers
-- ---------------------------------------------------------------------------

-- New job dispatched to a provider (initial broadcast and the 5km widening).
create or replace function private.notify_job_dispatch()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = new.job_id;
  perform private.notify(
    new.provider_id, 'job_request',
    'New ' || private.service_name(j.category) || ' request',
    j.landmark || ' • ' || new.distance_km || 'km away • ' || private.naira(j.budget),
    jsonb_build_object('url', '/request/' || j.id, 'jobId', j.id)
  );
  return new;
end $$;

create trigger job_dispatches_notify after insert on public.job_dispatches
  for each row execute function private.notify_job_dispatch();

-- Negotiation steps. Each change tells the other side what happened.
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
      if old.status = 'awaiting_customer' then
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
      perform private.notify(new.provider_id, 'booking_confirmed', 'You''ve been booked!',
        'Your ' || lower(service) || ' job on ' || to_char(j.scheduled_at at time zone 'Africa/Lagos', 'Dy DD Mon, HH12:MI AM')
          || ' is confirmed for ' || private.naira(new.amount) || '.',
        jsonb_build_object('url', '/(provider-tabs)/jobs', 'jobId', new.job_id));
    when 'not_selected' then
      perform private.notify(new.provider_id, 'offer_not_selected', 'Customer chose another provider',
        'The ' || lower(service) || ' job near ' || j.landmark || ' was booked by someone else.', to_provider);
    else
      null;
  end case;
  return new;
end $$;

create trigger offers_notify after insert or update of status on public.offers
  for each row execute function private.notify_offer_change();

-- Booking progress, for the customer.
create or replace function private.notify_booking_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  provider_name text := private.person_first_name(new.provider_id);
  service text := lower(private.service_name(new.category));
  data jsonb := jsonb_build_object('url', '/(customer-tabs)/history', 'bookingId', new.id);
begin
  if new.status = old.status then return new; end if;
  case new.status
    when 'en_route' then
      perform private.notify(new.customer_id, 'provider_on_the_way', provider_name || ' is on the way', 'Your ' || service || ' provider is heading to you.', data);
    when 'in_progress' then
      perform private.notify(new.customer_id, 'service_started', 'Your service has started', provider_name || ' has started your ' || service || ' job.', data);
    when 'completed' then
      perform private.notify(new.customer_id, 'service_completed', 'Service completed', 'How did ' || provider_name || ' do? Rate your ' || service || ' service.', data);
    when 'cancelled' then
      perform private.notify(new.customer_id, 'booking_cancelled', 'Booking cancelled', 'Your ' || service || ' booking was cancelled.', data);
      perform private.notify(new.provider_id, 'booking_cancelled', 'Booking cancelled', 'The ' || service || ' booking was cancelled.',
        jsonb_build_object('url', '/(provider-tabs)/jobs', 'bookingId', new.id));
    else
      null;
  end case;
  return new;
end $$;

create trigger bookings_notify after update of status on public.bookings
  for each row execute function private.notify_booking_change();

-- Support team replies.
create or replace function private.notify_support_reply()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.sender = 'agent' then
    perform private.notify(new.user_id, 'support_message', 'QwikHelp Support replied', left(new.body, 140), jsonb_build_object('url', '/support'));
  end if;
  return new;
end $$;

create trigger support_messages_notify after insert on public.support_messages
  for each row execute function private.notify_support_reply();

-- Internal helpers: only reachable through the security-definer triggers above.
revoke execute on function private.notify(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function private.service_name(text) from public, anon, authenticated;
revoke execute on function private.person_first_name(text) from public, anon, authenticated;
