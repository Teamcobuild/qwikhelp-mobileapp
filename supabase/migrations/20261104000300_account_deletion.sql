-- In-app account deletion (Google Play requirement; Privacy Policy section 4).
--
-- delete_my_account() runs as the user and does the database part: it refuses while money or a job is in
-- flight, closes open requests/offers, then deletes or anonymises personal data. Payment, booking and wallet
-- rows are kept (anonymised) because financial records must be retained. The `account` edge function then
-- removes the user's files from storage and deletes their Clerk login.

alter table public.profiles add column if not exists deleted_at timestamptz;

create or replace function public.delete_my_account()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  chat_paths text[];
  r record;
begin
  if exists (select 1 from public.bookings
              where uid in (customer_id, provider_id)
                and status in ('confirmed', 'en_route', 'in_progress', 'awaiting_confirmation')) then
    raise exception 'You have an active booking. Finish or cancel it before deleting your account.';
  end if;
  if coalesce((select sum(amount) from public.wallet_entries where provider_id = uid), 0) > 0 then
    raise exception 'You still have money in your wallet. Withdraw it before deleting your account.';
  end if;
  if exists (select 1 from public.withdrawals where provider_id = uid and status = 'pending') then
    raise exception 'Please wait for your withdrawal to finish before deleting your account.';
  end if;

  -- Close anything still open.
  for r in select id from public.bookings where uid in (customer_id, provider_id) and status = 'pending_payment' loop
    perform private.release_hold(r.id, 'account_deleted');
  end loop;
  update public.offers set status = 'job_closed', expires_at = null
   where job_id in (select id from public.jobs where customer_id = uid and status = 'open')
     and status in ('awaiting_customer', 'awaiting_provider', 'agreed', 'selected');
  update public.jobs set status = 'cancelled' where customer_id = uid and status = 'open';
  update public.offers set status = 'withdrawn', expires_at = null
   where provider_id = uid and status in ('awaiting_customer', 'awaiting_provider', 'agreed');

  -- Messages: keep the thread readable for the other person, drop the content.
  select coalesce(array_agg(image_path), '{}') into chat_paths
    from public.messages where sender_id = uid and image_path is not null;
  update public.messages
     set body = 'Message deleted', image_path = null, masked = false,
         kind = case when kind = 'image' then 'text' else kind end
   where sender_id = uid;

  -- Personal data that isn't needed for financial records.
  delete from public.chat_flags where user_id = uid;
  delete from public.notifications where user_id = uid;
  delete from public.support_messages where user_id = uid;
  delete from public.assistant_usage where user_id = uid;
  delete from public.kyc_submissions where user_id = uid;
  delete from public.payout_accounts where provider_id = uid;

  update public.provider_profiles
     set is_online = false, bio = null, base_address = null, base_lat = null, base_lng = null, city = null
   where user_id = uid;

  update public.jobs set description = 'Deleted request', photo_paths = '{}', landmark = 'Deleted' where customer_id = uid;
  update public.job_locations set address = 'Deleted', lat = 0, lng = 0
   where job_id in (select id from public.jobs where customer_id = uid);

  update public.profiles
     set full_name = 'Deleted user', phone = null, avatar_url = null, expo_push_token = null, deleted_at = now()
   where id = uid;

  return jsonb_build_object('uid', uid, 'chat_image_paths', to_jsonb(chat_paths));
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Ratings are "coming soon": stop the completion notification asking customers to rate.
-- Patches only that one message inside notify_booking_change() rather than restating the whole function.
do $$
declare def text;
begin
  def := pg_get_functiondef('private.notify_booking_change()'::regprocedure);
  def := replace(def,
    $old$'How did ' || provider_name || ' do? Rate your ' || service || ' service.'$old$,
    $new$'Your ' || service || ' job with ' || provider_name || ' is complete. Thanks for using QwikHelp!'$new$);
  if position('Rate your' in def) > 0 then raise exception 'notify_booking_change text not found'; end if;
  execute def;
end $$;
