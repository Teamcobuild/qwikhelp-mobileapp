-- Align KYC schema with the onboarding screens.

-- Experience is picked from labels ('1-2 yrs', '3-5 yrs', '6+ yrs').
alter table public.provider_profiles
  alter column years_experience type text using years_experience::text;

-- Store the base as plain lat/lng (easy to read back on the client); derive the geography for matching.
drop index if exists public.provider_profiles_location_idx;
alter table public.provider_profiles drop column base_location;
alter table public.provider_profiles
  add column base_lat double precision check (base_lat between -90 and 90),
  add column base_lng double precision check (base_lng between -180 and 180),
  add column base_location extensions.geography(point, 4326) generated always as (
    case when base_lat is not null and base_lng is not null
      then extensions.st_setsrid(extensions.st_makepoint(base_lng, base_lat), 4326)::extensions.geography
    end
  ) stored;
create index provider_profiles_location_idx on public.provider_profiles using gist (base_location);

grant update (base_lat, base_lng) on public.provider_profiles to authenticated;

-- Titles shown next to each proof-of-work photo.
alter table public.kyc_submissions
  add column proof_of_work_titles text[] not null default '{}';

-- Providers may correct their details while under review (lenient MVP), but not once approved/rejected.
create or replace function private.provider_can_edit_kyc(uid text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.provider_profiles
    where user_id = uid and status in ('draft', 'submitted', 'needs_changes')
  )
$$;
