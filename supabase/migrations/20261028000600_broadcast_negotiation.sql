-- QwikHelp: job broadcast + negotiation
--
-- Flow
--   customer create_job()  -> dispatch to approved, online providers of that trade within 3km (5km if none)
--   provider provider_respond(accept | counter R1)
--   customer customer_respond(accept | decline | final counter R2)          [30 min to respond]
--   provider provider_final(accept | walk_away)                              [30 min to respond]
--   -> offer 'agreed'. Several providers can reach 'agreed'; the customer picks one with select_offer().
--   select_offer() re-checks provider capacity, creates the booking, closes every other offer.
--
-- Privacy: providers never see the exact address/coordinates (job_locations is customer-only), only the
-- landmark and a rounded distance. Counterpart names come from RPCs that never return phone numbers.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Service catalog (shared by customer categories and provider trades)
-- ---------------------------------------------------------------------------
create table public.service_categories (
  id text primary key,
  name text not null,
  min_fare int not null check (min_fare > 0),
  active boolean not null default true
);

insert into public.service_categories (id, name, min_fare) values
  ('cooking', 'Cooking', 6000),
  ('cleaning', 'Cleaning', 5000),
  ('laundry', 'Laundry', 3000),
  ('companion', 'Companion', 8000),
  ('tour_guide', 'Tour Guide', 10000),
  ('plumbing', 'Plumbing', 7000),
  ('electrical', 'Electrical Repairs', 7000),
  ('gardening', 'Gardening', 5000),
  ('carpentry', 'Carpentry', 7000);

alter table public.service_categories enable row level security;
create policy "service_categories: read" on public.service_categories
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.job_status as enum ('open', 'booked', 'expired', 'cancelled');
create type public.offer_status as enum (
  'awaiting_customer',  -- provider countered (round 1), customer to respond
  'awaiting_provider',  -- customer final-countered (round 2), provider to respond
  'agreed',             -- price agreed; customer may select this provider
  'selected',           -- became the booking
  'declined',           -- customer declined the provider's counter
  'walked_away',        -- provider rejected the customer's final counter
  'expired',            -- response timer ran out
  'withdrawn',          -- provider withdrew (or lost capacity before selection)
  'not_selected',       -- customer booked someone else
  'job_closed'          -- job expired or was cancelled
);
create type public.booking_status as enum ('confirmed', 'en_route', 'in_progress', 'completed', 'cancelled', 'disputed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references public.profiles (id) on delete cascade,
  category text not null references public.service_categories (id),
  sub_category text,
  description text not null check (char_length(description) between 5 and 1000),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 4),
  scheduled_at timestamptz not null,
  duration_hours int not null check (duration_hours between 1 and 12),
  budget int not null check (budget > 0),
  landmark text not null check (char_length(landmark) between 2 and 120),
  city text,
  search_radius_km numeric(4, 1) not null default 3,
  status public.job_status not null default 'open',
  expires_at timestamptz not null,
  widened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_customer_idx on public.jobs (customer_id, created_at desc);
create index jobs_open_idx on public.jobs (status, expires_at) where status = 'open';
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- Exact location: customer-only.
create table public.job_locations (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  address text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography(point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
  ) stored
);

create table public.job_dispatches (
  job_id uuid not null references public.jobs (id) on delete cascade,
  provider_id text not null references public.profiles (id) on delete cascade,
  distance_km numeric(5, 1) not null,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (job_id, provider_id)
);
create index job_dispatches_provider_idx on public.job_dispatches (provider_id, created_at desc);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  provider_id text not null references public.profiles (id) on delete cascade,
  customer_id text not null references public.profiles (id) on delete cascade,
  amount int not null,             -- price currently on the table
  provider_counter int,            -- round 1
  customer_counter int,            -- round 2 (final)
  status public.offer_status not null,
  expires_at timestamptz,          -- set while awaiting a response
  distance_km numeric(5, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, provider_id)
);
create index offers_customer_idx on public.offers (customer_id, job_id);
create index offers_provider_idx on public.offers (provider_id, updated_at desc);
create index offers_awaiting_idx on public.offers (expires_at)
  where status in ('awaiting_customer', 'awaiting_provider');
create trigger offers_updated_at before update on public.offers
  for each row execute function public.set_updated_at();

create table public.offer_events (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.offers (id) on delete cascade,
  actor text not null check (actor in ('provider', 'customer', 'system')),
  action text not null,
  amount int,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index offer_events_offer_idx on public.offer_events (offer_id, created_at);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  offer_id uuid not null unique references public.offers (id) on delete cascade,
  customer_id text not null references public.profiles (id),
  provider_id text not null references public.profiles (id),
  category text not null references public.service_categories (id),
  agreed_amount int not null,
  scheduled_at timestamptz not null,
  duration_hours int not null,
  status public.booking_status not null default 'confirmed',
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_provider_idx on public.bookings (provider_id, scheduled_at);
create index bookings_customer_idx on public.bookings (customer_id, scheduled_at desc);
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (reads only; every write goes through the RPCs below)
-- ---------------------------------------------------------------------------
create or replace function private.can_see_job(p_job uuid, p_uid text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.jobs where id = p_job and customer_id = p_uid)
      or exists (select 1 from public.job_dispatches where job_id = p_job and provider_id = p_uid)
$$;
grant execute on function private.can_see_job(uuid, text) to authenticated;

alter table public.jobs enable row level security;
alter table public.job_locations enable row level security;
alter table public.job_dispatches enable row level security;
alter table public.offers enable row level security;
alter table public.offer_events enable row level security;
alter table public.bookings enable row level security;

create policy "jobs: customer or dispatched provider" on public.jobs
  for select to authenticated
  using (private.can_see_job(id, (select public.requesting_user_id())));

create policy "job_locations: customer only" on public.job_locations
  for select to authenticated
  using (exists (select 1 from public.jobs j
                 where j.id = job_id and j.customer_id = (select public.requesting_user_id())));

create policy "job_dispatches: own" on public.job_dispatches
  for select to authenticated
  using (provider_id = (select public.requesting_user_id()));

create policy "offers: parties" on public.offers
  for select to authenticated
  using ((select public.requesting_user_id()) in (provider_id, customer_id));

create policy "offer_events: parties" on public.offer_events
  for select to authenticated
  using (exists (select 1 from public.offers o
                 where o.id = offer_id
                   and (select public.requesting_user_id()) in (o.provider_id, o.customer_id)));

create policy "bookings: parties" on public.bookings
  for select to authenticated
  using ((select public.requesting_user_id()) in (provider_id, customer_id));

-- ---------------------------------------------------------------------------
-- Matching
-- ---------------------------------------------------------------------------
-- A provider is excluded if they already have 2+ active bookings within ±2h of the slot,
-- or 3+ bookings that day (Lagos time).
create or replace function private.provider_has_capacity(p_provider text, p_at timestamptz, p_hours int)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*) from public.bookings b
      where b.provider_id = p_provider
        and b.status in ('confirmed', 'en_route', 'in_progress')
        and b.scheduled_at < p_at + make_interval(hours => p_hours) + interval '2 hours'
        and b.scheduled_at + make_interval(hours => b.duration_hours) > p_at - interval '2 hours') < 2
    and
    (select count(*) from public.bookings b
      where b.provider_id = p_provider
        and b.status in ('confirmed', 'en_route', 'in_progress', 'completed')
        and (b.scheduled_at at time zone 'Africa/Lagos')::date = (p_at at time zone 'Africa/Lagos')::date) < 3
$$;

create or replace function private.dispatch_job(p_job uuid, p_radius_km numeric)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  j public.jobs;
  loc extensions.geography;
  n int;
begin
  select * into j from public.jobs where id = p_job;
  if j.status <> 'open' then return 0; end if;
  select location into loc from public.job_locations where job_id = p_job;

  insert into public.job_dispatches (job_id, provider_id, distance_km)
  select j.id, p.user_id, round((extensions.st_distance(p.base_location, loc) / 1000)::numeric, 1)
    from public.provider_profiles p
   where p.status = 'approved'
     and p.is_online
     and p.trade = j.category
     and p.user_id <> j.customer_id
     and p.base_location is not null
     and extensions.st_dwithin(p.base_location, loc, p_radius_km * 1000)
     and private.provider_has_capacity(p.user_id, j.scheduled_at, j.duration_hours)
  on conflict do nothing;
  get diagnostics n = row_count;

  if p_radius_km > j.search_radius_km then
    update public.jobs set search_radius_km = p_radius_km, widened_at = now() where id = p_job;
  end if;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.log_offer_event(p_offer uuid, p_actor text, p_action text, p_amount int, p_note text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.offer_events (offer_id, actor, action, amount, note)
  values (p_offer, p_actor, p_action, p_amount, nullif(trim(p_note), ''))
$$;

create or replace function private.require_uid()
returns text
language plpgsql stable set search_path = ''
as $$
declare uid text := public.requesting_user_id();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  return uid;
end $$;

-- ---------------------------------------------------------------------------
-- Customer: post a job
-- ---------------------------------------------------------------------------
create or replace function public.create_job(
  p_category text,
  p_sub_category text,
  p_description text,
  p_photo_paths text[],
  p_scheduled_at timestamptz,
  p_duration_hours int,
  p_budget int,
  p_landmark text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_city text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  min_fare int;
  jid uuid;
  n int;
begin
  if (select role from public.profiles where id = uid) is distinct from 'customer' then
    raise exception 'Only customers can post jobs';
  end if;

  select s.min_fare into min_fare from public.service_categories s where s.id = p_category and s.active;
  if min_fare is null then raise exception 'This service is not available'; end if;
  if p_budget < min_fare then raise exception 'The minimum fare for this service is ₦%', min_fare; end if;
  if p_scheduled_at < now() - interval '5 minutes' then raise exception 'Please pick a time in the future'; end if;
  if p_scheduled_at > now() + interval '30 days' then raise exception 'Jobs can be scheduled up to 30 days ahead'; end if;
  if exists (select 1 from unnest(coalesce(p_photo_paths, '{}')) path where path not like uid || '/%') then
    raise exception 'Invalid photo';
  end if;

  insert into public.jobs (customer_id, category, sub_category, description, photo_paths, scheduled_at,
                           duration_hours, budget, landmark, city, expires_at)
  values (uid, p_category, nullif(trim(p_sub_category), ''), trim(p_description), coalesce(p_photo_paths, '{}'),
          p_scheduled_at, p_duration_hours, p_budget, trim(p_landmark), nullif(trim(p_city), ''),
          -- open until 1h before start (at least 30 min), and never more than 24h
          least(now() + interval '24 hours', greatest(p_scheduled_at - interval '1 hour', now() + interval '30 minutes')))
  returning id into jid;

  insert into public.job_locations (job_id, address, lat, lng) values (jid, trim(p_address), p_lat, p_lng);

  n := private.dispatch_job(jid, 3);
  if n = 0 then n := private.dispatch_job(jid, 5); end if;

  return jsonb_build_object('job_id', jid, 'dispatched', n);
end $$;

create or replace function public.cancel_job(p_job uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare uid text := private.require_uid();
begin
  update public.jobs set status = 'cancelled' where id = p_job and customer_id = uid and status = 'open';
  if not found then raise exception 'This job can no longer be cancelled'; end if;
  update public.offers set status = 'job_closed', expires_at = null
   where job_id = p_job and status in ('awaiting_customer', 'awaiting_provider', 'agreed');
end $$;

-- ---------------------------------------------------------------------------
-- Provider: first response (accept the customer's price or counter, round 1)
-- ---------------------------------------------------------------------------
create or replace function public.provider_respond(p_job uuid, p_action text, p_amount int default null, p_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  j public.jobs;
  d public.job_dispatches;
  oid uuid;
begin
  select * into d from public.job_dispatches where job_id = p_job and provider_id = uid;
  if not found then raise exception 'This request is not available to you'; end if;
  if (select status from public.provider_profiles where user_id = uid) <> 'approved' then
    raise exception 'Your provider account is not active';
  end if;

  select * into j from public.jobs where id = p_job for share;
  if j.status <> 'open' or j.expires_at < now() then raise exception 'This job is no longer available'; end if;
  if exists (select 1 from public.offers where job_id = p_job and provider_id = uid) then
    raise exception 'You have already responded to this job';
  end if;

  if p_action = 'accept' then
    insert into public.offers (job_id, provider_id, customer_id, amount, status, distance_km)
    values (p_job, uid, j.customer_id, j.budget, 'agreed', d.distance_km)
    returning id into oid;
    perform private.log_offer_event(oid, 'provider', 'accept', j.budget, p_note);

  elsif p_action = 'counter' then
    if p_amount is null or p_amount <= j.budget then
      raise exception 'Your counter-offer must be higher than ₦%', j.budget;
    end if;
    if p_amount > j.budget * 3 then
      raise exception 'Your counter-offer cannot be more than ₦%', j.budget * 3;
    end if;
    insert into public.offers (job_id, provider_id, customer_id, amount, provider_counter, status, expires_at, distance_km)
    values (p_job, uid, j.customer_id, p_amount, p_amount, 'awaiting_customer',
            least(now() + interval '30 minutes', j.expires_at), d.distance_km)
    returning id into oid;
    perform private.log_offer_event(oid, 'provider', 'counter', p_amount, p_note);

  else
    raise exception 'Unknown action';
  end if;

  return oid;
end $$;

-- Provider hides a request they are not interested in (no offer is created).
create or replace function public.dismiss_job(p_job uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare uid text := private.require_uid();
begin
  update public.job_dispatches set dismissed_at = now()
   where job_id = p_job and provider_id = uid
     and not exists (select 1 from public.offers where job_id = p_job and provider_id = uid);
end $$;

-- ---------------------------------------------------------------------------
-- Customer: respond to a provider's counter (accept | decline | final counter, round 2)
-- ---------------------------------------------------------------------------
create or replace function public.customer_respond(p_offer uuid, p_action text, p_amount int default null, p_note text default null)
returns public.offer_status
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  o public.offers;
  j public.jobs;
begin
  select * into o from public.offers where id = p_offer and customer_id = uid for update;
  if not found then raise exception 'Offer not found'; end if;
  select * into j from public.jobs where id = o.job_id;

  if j.status <> 'open' then raise exception 'This job is no longer open'; end if;
  if o.status <> 'awaiting_customer' then raise exception 'This offer is no longer waiting for your response'; end if;
  if o.expires_at < now() then
    update public.offers set status = 'expired', expires_at = null where id = p_offer;
    return 'expired';
  end if;

  if p_action = 'accept' then
    update public.offers set status = 'agreed', amount = o.provider_counter, expires_at = null where id = p_offer;
    perform private.log_offer_event(p_offer, 'customer', 'accept', o.provider_counter, p_note);
    return 'agreed';

  elsif p_action = 'decline' then
    update public.offers set status = 'declined', expires_at = null where id = p_offer;
    perform private.log_offer_event(p_offer, 'customer', 'decline', null, p_note);
    return 'declined';

  elsif p_action = 'counter' then
    if p_amount is null or p_amount <= j.budget or p_amount >= o.provider_counter then
      raise exception 'Your final offer must be between ₦% and ₦%', j.budget, o.provider_counter;
    end if;
    update public.offers
       set status = 'awaiting_provider', amount = p_amount, customer_counter = p_amount,
           expires_at = least(now() + interval '30 minutes', j.expires_at)
     where id = p_offer;
    perform private.log_offer_event(p_offer, 'customer', 'counter', p_amount, p_note);
    return 'awaiting_provider';
  end if;

  raise exception 'Unknown action';
end $$;

-- ---------------------------------------------------------------------------
-- Provider: answer the customer's final counter (accept | walk_away)
-- ---------------------------------------------------------------------------
create or replace function public.provider_final(p_offer uuid, p_action text, p_note text default null)
returns public.offer_status
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  o public.offers;
begin
  select * into o from public.offers where id = p_offer and provider_id = uid for update;
  if not found then raise exception 'Offer not found'; end if;
  if (select status from public.jobs where id = o.job_id) <> 'open' then raise exception 'This job is no longer open'; end if;
  if o.status <> 'awaiting_provider' then raise exception 'This offer is no longer waiting for your response'; end if;
  if o.expires_at < now() then
    update public.offers set status = 'expired', expires_at = null where id = p_offer;
    return 'expired';
  end if;

  if p_action = 'accept' then
    update public.offers set status = 'agreed', amount = o.customer_counter, expires_at = null where id = p_offer;
    perform private.log_offer_event(p_offer, 'provider', 'accept', o.customer_counter, p_note);
    return 'agreed';
  elsif p_action = 'walk_away' then
    update public.offers set status = 'walked_away', expires_at = null where id = p_offer;
    perform private.log_offer_event(p_offer, 'provider', 'walk_away', null, p_note);
    return 'walked_away';
  end if;

  raise exception 'Unknown action';
end $$;

create or replace function public.withdraw_offer(p_offer uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare uid text := private.require_uid();
begin
  update public.offers set status = 'withdrawn', expires_at = null
   where id = p_offer and provider_id = uid
     and status in ('awaiting_customer', 'awaiting_provider', 'agreed');
  if not found then raise exception 'This offer can no longer be withdrawn'; end if;
  perform private.log_offer_event(p_offer, 'provider', 'withdraw', null, null);
end $$;

-- ---------------------------------------------------------------------------
-- Customer: pick an agreed offer -> booking
-- ---------------------------------------------------------------------------
create or replace function public.select_offer(p_offer uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  o public.offers;
  j public.jobs;
  bid uuid;
begin
  select * into o from public.offers where id = p_offer and customer_id = uid for update;
  if not found then raise exception 'Offer not found'; end if;
  select * into j from public.jobs where id = o.job_id for update;

  if j.status <> 'open' then raise exception 'This job is no longer open'; end if;
  if o.status <> 'agreed' then raise exception 'You can only book a provider once a price is agreed'; end if;

  -- The provider may have been booked elsewhere since agreeing.
  if not private.provider_has_capacity(o.provider_id, j.scheduled_at, j.duration_hours) then
    update public.offers set status = 'withdrawn' where id = p_offer;
    perform private.log_offer_event(p_offer, 'system', 'capacity_withdrawn', null, null);
    return jsonb_build_object('ok', false, 'reason', 'provider_unavailable');
  end if;

  insert into public.bookings (job_id, offer_id, customer_id, provider_id, category, agreed_amount, scheduled_at, duration_hours)
  values (j.id, o.id, o.customer_id, o.provider_id, j.category, o.amount, j.scheduled_at, j.duration_hours)
  returning id into bid;

  update public.offers set status = 'selected' where id = p_offer;
  perform private.log_offer_event(p_offer, 'customer', 'select', o.amount, null);

  update public.offers set status = 'not_selected', expires_at = null
   where job_id = j.id and id <> p_offer and status in ('awaiting_customer', 'awaiting_provider', 'agreed');

  update public.jobs set status = 'booked' where id = j.id;

  return jsonb_build_object('ok', true, 'booking_id', bid);
end $$;

-- ---------------------------------------------------------------------------
-- Reads (counterpart names/avatars without phone numbers)
-- ---------------------------------------------------------------------------
create or replace function private.first_name(p_name text)
returns text
language sql immutable set search_path = ''
as $$ select coalesce(nullif(split_part(trim(coalesce(p_name, '')), ' ', 1), ''), 'Customer') $$;

create or replace function private.provider_card(p_provider text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', coalesce(p.full_name, 'Provider'),
    'avatar_url', p.avatar_url,
    'trade', pp.trade,
    'bio', pp.bio,
    'years_experience', pp.years_experience,
    'rating', pp.rating,
    'review_count', pp.review_count,
    'verified', pp.status = 'approved'
  )
  from public.profiles p
  join public.provider_profiles pp on pp.user_id = p.id
  where p.id = p_provider
$$;

create or replace function private.job_json(j public.jobs)
returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'id', j.id, 'category', j.category, 'sub_category', j.sub_category, 'description', j.description,
    'photo_paths', to_jsonb(j.photo_paths), 'scheduled_at', j.scheduled_at, 'duration_hours', j.duration_hours,
    'budget', j.budget, 'landmark', j.landmark, 'city', j.city, 'status', j.status,
    'expires_at', j.expires_at, 'search_radius_km', j.search_radius_km, 'created_at', j.created_at
  )
$$;

create or replace function private.offer_json(o public.offers)
returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id, 'job_id', o.job_id, 'status', o.status, 'amount', o.amount,
    'provider_counter', o.provider_counter, 'customer_counter', o.customer_counter,
    'expires_at', o.expires_at, 'distance_km', o.distance_km, 'updated_at', o.updated_at
  )
$$;

-- Customer: a job with every offer (neutral order: price, then rating, then distance).
create or replace function public.get_job_offers(p_job uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  j public.jobs;
begin
  select * into j from public.jobs where id = p_job and customer_id = uid;
  if not found then raise exception 'Job not found'; end if;

  return jsonb_build_object(
    'job', private.job_json(j) || jsonb_build_object(
      'address', (select address from public.job_locations where job_id = j.id)),
    'dispatched_count', (select count(*) from public.job_dispatches where job_id = j.id),
    'booking_id', (select id from public.bookings where job_id = j.id),
    'offers', coalesce((
      select jsonb_agg(private.offer_json(o) || jsonb_build_object('provider', private.provider_card(o.provider_id))
                       order by o.amount, pp.rating desc, o.distance_km)
        from public.offers o
        join public.provider_profiles pp on pp.user_id = o.provider_id
       where o.job_id = j.id
    ), '[]'::jsonb)
  );
end $$;

-- Either party: one offer with its negotiation history and the counterpart.
create or replace function public.get_offer_detail(p_offer uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  o public.offers;
  j public.jobs;
begin
  select * into o from public.offers where id = p_offer and uid in (provider_id, customer_id);
  if not found then raise exception 'Offer not found'; end if;
  select * into j from public.jobs where id = o.job_id;

  return private.offer_json(o) || jsonb_build_object(
    'job', private.job_json(j),
    'viewer', case when uid = o.customer_id then 'customer' else 'provider' end,
    'provider', private.provider_card(o.provider_id),
    'customer_name', (select private.first_name(full_name) from public.profiles where id = o.customer_id),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('actor', e.actor, 'action', e.action, 'amount', e.amount,
                                          'note', e.note, 'created_at', e.created_at) order by e.created_at)
        from public.offer_events e where e.offer_id = o.id
    ), '[]'::jsonb)
  );
end $$;

-- Provider: open requests dispatched to me, each with my offer (if any).
create or replace function public.get_provider_feed()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare uid text := private.require_uid();
begin
  return coalesce((
    select jsonb_agg(
             private.job_json(j) || jsonb_build_object(
               'distance_km', d.distance_km,
               'dispatched_at', d.created_at,
               'customer_name', private.first_name(c.full_name),
               'offer', case when o.id is null then null else private.offer_json(o) end
             ) order by d.created_at desc)
      from public.job_dispatches d
      join public.jobs j on j.id = d.job_id
      join public.profiles c on c.id = j.customer_id
      left join public.offers o on o.job_id = j.id and o.provider_id = uid
     where d.provider_id = uid
       and d.dismissed_at is null
       and j.status = 'open'
       and j.expires_at > now()
       and (o.id is null or o.status in ('awaiting_customer', 'awaiting_provider', 'agreed'))
  ), '[]'::jsonb);
end $$;

-- Provider or customer: my bookings with the counterpart's display name.
create or replace function public.get_my_bookings()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare uid text := private.require_uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', b.id, 'job_id', b.job_id, 'offer_id', b.offer_id, 'status', b.status,
             'agreed_amount', b.agreed_amount, 'scheduled_at', b.scheduled_at, 'duration_hours', b.duration_hours,
             'category', b.category, 'description', j.description, 'landmark', j.landmark,
             'payment_status', b.payment_status,
             'role', case when uid = b.customer_id then 'customer' else 'provider' end,
             'customer_name', private.first_name(c.full_name),
             'provider', private.provider_card(b.provider_id)
           ) order by b.scheduled_at desc)
      from public.bookings b
      join public.jobs j on j.id = b.job_id
      join public.profiles c on c.id = b.customer_id
     where uid in (b.customer_id, b.provider_id)
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Background sweep (every minute): timers, job expiry, radius widening, late joiners
-- ---------------------------------------------------------------------------
create or replace function private.broadcast_sweep()
returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  update public.offers set status = 'expired', expires_at = null
   where status in ('awaiting_customer', 'awaiting_provider') and expires_at < now();

  update public.jobs set status = 'expired' where status = 'open' and expires_at < now();

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

select cron.schedule('qwikhelp-broadcast-sweep', '* * * * *', $$select private.broadcast_sweep()$$);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.create_job(text, text, text, text[], timestamptz, int, int, text, text, double precision, double precision, text),
  public.cancel_job(uuid),
  public.provider_respond(uuid, text, int, text),
  public.dismiss_job(uuid),
  public.customer_respond(uuid, text, int, text),
  public.provider_final(uuid, text, text),
  public.withdraw_offer(uuid),
  public.select_offer(uuid),
  public.get_job_offers(uuid),
  public.get_offer_detail(uuid),
  public.get_provider_feed(),
  public.get_my_bookings()
from public, anon;

grant execute on function
  public.create_job(text, text, text, text[], timestamptz, int, int, text, text, double precision, double precision, text),
  public.cancel_job(uuid),
  public.provider_respond(uuid, text, int, text),
  public.dismiss_job(uuid),
  public.customer_respond(uuid, text, int, text),
  public.provider_final(uuid, text, text),
  public.withdraw_offer(uuid),
  public.select_offer(uuid),
  public.get_job_offers(uuid),
  public.get_offer_detail(uuid),
  public.get_provider_feed(),
  public.get_my_bookings()
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.job_dispatches, public.offers, public.jobs, public.bookings;

-- ---------------------------------------------------------------------------
-- Storage: job photos (private). Customer writes to {uid}/...; dispatched providers can read.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

create or replace function private.can_read_job_photo(p_name text, p_uid text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j
    join public.job_dispatches d on d.job_id = j.id
    where d.provider_id = p_uid and p_name = any (j.photo_paths)
  )
$$;
grant execute on function private.can_read_job_photo(text, text) to authenticated;

create policy "job-photos: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] = (select public.requesting_user_id()));

create policy "job-photos: owner or dispatched provider read" on storage.objects
  for select to authenticated
  using (bucket_id = 'job-photos'
         and ((storage.foldername(name))[1] = (select public.requesting_user_id())
              or private.can_read_job_photo(name, (select public.requesting_user_id()))));
