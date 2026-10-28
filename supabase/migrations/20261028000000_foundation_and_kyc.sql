-- QwikHelp: foundation + provider KYC
-- Auth is Clerk (Supabase third-party auth). The Clerk user id ("user_...") is the primary key everywhere.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.requesting_user_id()
returns text
language sql stable
as $$ select nullif(auth.jwt() ->> 'sub', '') $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- App settings (single row). kyc_auto_approve lets test builds skip manual review.
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  kyc_auto_approve boolean not null default false
);
insert into public.app_settings default values;
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'provider');
create type public.provider_status as enum ('draft', 'submitted', 'needs_changes', 'approved', 'rejected');

create table public.profiles (
  id text primary key default public.requesting_user_id(),
  role public.user_role not null,
  full_name text,
  phone text,
  avatar_url text,
  expo_push_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = public.requesting_user_id());
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = public.requesting_user_id());
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = public.requesting_user_id()) with check (id = public.requesting_user_id());

-- Role is fixed once chosen.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, expo_push_token) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Provider profiles (public-facing data + verification status)
-- ---------------------------------------------------------------------------
create table public.provider_profiles (
  user_id text primary key default public.requesting_user_id()
    references public.profiles (id) on delete cascade,
  status public.provider_status not null default 'draft',
  trade text,
  trade_subtitle text,
  bio text,
  years_experience int,
  city text,
  base_address text,
  base_location extensions.geography(point, 4326),
  service_radius_km int not null default 10,
  is_online boolean not null default false,
  rating numeric(2, 1) not null default 0,
  review_count int not null default 0,
  review_note text,            -- shown to the provider when needs_changes / rejected
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index provider_profiles_location_idx on public.provider_profiles using gist (base_location);
create index provider_profiles_trade_idx on public.provider_profiles (trade) where status = 'approved';

create trigger provider_profiles_updated_at before update on public.provider_profiles
  for each row execute function public.set_updated_at();

alter table public.provider_profiles enable row level security;

create policy "provider_profiles: read own" on public.provider_profiles
  for select to authenticated using (user_id = public.requesting_user_id());
create policy "provider_profiles: read approved" on public.provider_profiles
  for select to authenticated using (status = 'approved');
create policy "provider_profiles: insert own" on public.provider_profiles
  for insert to authenticated
  with check (user_id = public.requesting_user_id() and status = 'draft');
create policy "provider_profiles: update own" on public.provider_profiles
  for update to authenticated
  using (user_id = public.requesting_user_id()) with check (user_id = public.requesting_user_id());

-- Status, rating and review fields are server-controlled.
revoke update on public.provider_profiles from authenticated;
grant update (trade, trade_subtitle, bio, years_experience, city, base_address,
              base_location, service_radius_km, is_online)
  on public.provider_profiles to authenticated;

-- Only approved providers can go online.
create or replace function public.guard_provider_online()
returns trigger
language plpgsql
as $$
begin
  if new.is_online and new.status <> 'approved' then
    raise exception 'Only approved providers can go online';
  end if;
  return new;
end $$;

create trigger provider_profiles_guard_online before insert or update on public.provider_profiles
  for each row execute function public.guard_provider_online();

-- ---------------------------------------------------------------------------
-- KYC submissions (private: owner + service role only)
-- ---------------------------------------------------------------------------
create table public.kyc_submissions (
  user_id text primary key default public.requesting_user_id()
    references public.profiles (id) on delete cascade,
  -- Step 1: personal details
  legal_name text,
  phone text,
  avatar_path text,
  -- Step 2: NIN & government ID
  id_type text,
  document_number text,
  nin text check (nin is null or nin ~ '^\d{11}$'),
  dob date,
  id_image_path text,
  -- Step 3: biometric
  selfie_path text,
  -- Step 4: proof of work
  proof_of_work_paths text[] not null default '{}',
  work_description text,
  -- Step 5: base & terms
  workshop_photo_path text,
  sole_provider_agreed boolean not null default false,
  -- Step 6: guarantor
  guarantor_name text,
  guarantor_phone text,
  guarantor_relationship text,
  guarantor_address text,
  guarantor_nin text check (guarantor_nin is null or guarantor_nin ~ '^\d{11}$'),
  guarantor_consent_agreed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger kyc_submissions_updated_at before update on public.kyc_submissions
  for each row execute function public.set_updated_at();

alter table public.kyc_submissions enable row level security;

create or replace function public.provider_can_edit_kyc(uid text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.provider_profiles
    where user_id = uid and status in ('draft', 'needs_changes')
  )
$$;

create policy "kyc: read own" on public.kyc_submissions
  for select to authenticated using (user_id = public.requesting_user_id());
create policy "kyc: insert own" on public.kyc_submissions
  for insert to authenticated
  with check (user_id = public.requesting_user_id() and public.provider_can_edit_kyc(user_id));
create policy "kyc: update own while editable" on public.kyc_submissions
  for update to authenticated
  using (user_id = public.requesting_user_id() and public.provider_can_edit_kyc(user_id))
  with check (user_id = public.requesting_user_id());

-- ---------------------------------------------------------------------------
-- submit_kyc(): validates completeness and moves the provider to review
-- ---------------------------------------------------------------------------
create or replace function public.submit_kyc()
returns public.provider_status
language plpgsql security definer set search_path = public
as $$
declare
  uid text := public.requesting_user_id();
  p public.provider_profiles;
  k public.kyc_submissions;
  missing text[] := '{}';
  next_status public.provider_status;
begin
  select * into p from public.provider_profiles where user_id = uid for update;
  if not found then raise exception 'Provider profile not found'; end if;
  if p.status not in ('draft', 'needs_changes') then return p.status; end if;

  select * into k from public.kyc_submissions where user_id = uid;
  if not found then raise exception 'KYC has not been started'; end if;

  if k.legal_name is null then missing := missing || 'legal name'; end if;
  if p.trade is null then missing := missing || 'trade'; end if;
  if k.id_type is null or k.document_number is null then missing := missing || 'ID document'; end if;
  if k.dob is null then missing := missing || 'date of birth'; end if;
  if k.id_image_path is null then missing := missing || 'ID photo'; end if;
  if k.selfie_path is null then missing := missing || 'selfie'; end if;
  if cardinality(k.proof_of_work_paths) = 0 then missing := missing || 'proof of work'; end if;
  if p.base_address is null then missing := missing || 'base address'; end if;
  if not k.sole_provider_agreed then missing := missing || 'terms agreement'; end if;
  if k.guarantor_name is null or k.guarantor_phone is null then missing := missing || 'guarantor'; end if;
  if not k.guarantor_consent_agreed then missing := missing || 'guarantor consent'; end if;

  if cardinality(missing) > 0 then
    raise exception 'Incomplete KYC: %', array_to_string(missing, ', ');
  end if;

  select case when s.kyc_auto_approve then 'approved' else 'submitted' end::public.provider_status
    into next_status from public.app_settings s;

  update public.provider_profiles
     set status = next_status,
         submitted_at = now(),
         reviewed_at = case when next_status = 'approved' then now() end,
         review_note = null
   where user_id = uid;

  return next_status;
end $$;

revoke execute on function public.submit_kyc() from public, anon;
grant execute on function public.submit_kyc() to authenticated;

-- Pending screen listens for its own status change.
alter publication supabase_realtime add table public.provider_profiles;

-- ---------------------------------------------------------------------------
-- Storage
--   kyc        private, {userId}/...   ID, selfie, workshop photo
--   avatars    public,  {userId}/...
--   portfolio  public,  {userId}/...   proof-of-work photos (shown on provider profile)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('kyc', 'kyc', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('portfolio', 'portfolio', true, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

-- Owner read is also required for upserts. Public buckets are readable by URL without a policy.
create policy "storage: owner read" on storage.objects
  for select to authenticated
  using (bucket_id in ('kyc', 'avatars', 'portfolio')
         and (storage.foldername(name))[1] = public.requesting_user_id());

create policy "storage: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('kyc', 'avatars', 'portfolio')
              and (storage.foldername(name))[1] = public.requesting_user_id());

create policy "storage: owner update" on storage.objects
  for update to authenticated
  using (bucket_id in ('kyc', 'avatars', 'portfolio')
         and (storage.foldername(name))[1] = public.requesting_user_id());

create policy "storage: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('kyc', 'avatars', 'portfolio')
         and (storage.foldername(name))[1] = public.requesting_user_id());
