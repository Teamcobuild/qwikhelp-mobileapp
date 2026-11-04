-- Dispatch open jobs to a provider the moment they become available.
--
-- Before: create_job() only reached providers who were online at that instant; anyone who switched to
-- Active (or got approved, or changed trade) later had to wait for the once-a-minute broadcast_sweep.
-- Now the same dispatch_job() rules (approved, online, trade, radius, capacity) run immediately.

create or replace function private.dispatch_on_provider_available()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  if new.is_online and new.status = 'approved' and new.base_location is not null
     and (not old.is_online or old.status <> 'approved' or old.trade is distinct from new.trade) then
    for r in
      select id, search_radius_km from public.jobs
       where status = 'open' and category = new.trade and expires_at > now()
    loop
      perform private.dispatch_job(r.id, r.search_radius_km);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists provider_profiles_dispatch_on_available on public.provider_profiles;
create trigger provider_profiles_dispatch_on_available
  after update of is_online, status, trade on public.provider_profiles
  for each row execute function private.dispatch_on_provider_available();
