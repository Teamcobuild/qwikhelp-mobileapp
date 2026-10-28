-- Advisor fixes + webhook that syncs provider status to Clerk.

-- ---------------------------------------------------------------------------
-- Pin search_path on helper functions
-- ---------------------------------------------------------------------------
alter function public.requesting_user_id() set search_path = '';
alter function public.set_updated_at() set search_path = '';
alter function public.guard_provider_online() set search_path = '';

-- ---------------------------------------------------------------------------
-- RLS helpers live in a schema the Data API does not expose
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.provider_can_edit_kyc(uid text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.provider_profiles
    where user_id = uid and status in ('draft', 'needs_changes')
  )
$$;
revoke execute on function private.provider_can_edit_kyc(text) from public, anon;
grant execute on function private.provider_can_edit_kyc(text) to authenticated;

drop policy "kyc: insert own" on public.kyc_submissions;
drop policy "kyc: update own while editable" on public.kyc_submissions;

create policy "kyc: insert own" on public.kyc_submissions
  for insert to authenticated
  with check (user_id = (select public.requesting_user_id())
              and private.provider_can_edit_kyc(user_id));
create policy "kyc: update own while editable" on public.kyc_submissions
  for update to authenticated
  using (user_id = (select public.requesting_user_id())
         and private.provider_can_edit_kyc(user_id))
  with check (user_id = (select public.requesting_user_id()));

drop function public.provider_can_edit_kyc(text);

-- ---------------------------------------------------------------------------
-- One SELECT policy on provider_profiles
-- ---------------------------------------------------------------------------
drop policy "provider_profiles: read own" on public.provider_profiles;
drop policy "provider_profiles: read approved" on public.provider_profiles;
create policy "provider_profiles: read own or approved" on public.provider_profiles
  for select to authenticated
  using (user_id = (select public.requesting_user_id()) or status = 'approved');

-- ---------------------------------------------------------------------------
-- Status change -> provider-status-sync edge function
-- Requires Vault secrets: project_url, provider_status_webhook_secret
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;

create or replace function private.notify_provider_status_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  base_url text;
  secret text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'provider_status_webhook_secret';

  if base_url is null or secret is null then
    raise warning 'provider status webhook not configured; skipping';
    return new;
  end if;

  perform net.http_post(
    url := base_url || '/functions/v1/provider-status-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body := jsonb_build_object('type', 'UPDATE', 'record', to_jsonb(new), 'old_record', to_jsonb(old))
  );
  return new;
end $$;

create trigger provider_profiles_status_webhook
  after update of status on public.provider_profiles
  for each row when (old.status is distinct from new.status)
  execute function private.notify_provider_status_change();
