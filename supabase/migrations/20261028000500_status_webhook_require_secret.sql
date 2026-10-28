-- Treat an empty webhook secret as "not configured" instead of sending a blank header.
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

  if coalesce(base_url, '') = '' or coalesce(secret, '') = '' then
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
