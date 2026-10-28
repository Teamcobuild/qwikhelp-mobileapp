-- Public profile of an approved provider (what customers see before booking).
-- No phone numbers, no exact base coordinates; only city-level location and the public portfolio.
create or replace function public.get_provider_profile(p_provider text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid text := private.require_uid();
  result jsonb;
begin
  select private.provider_card(pp.user_id) || jsonb_build_object(
           'trade_subtitle', pp.trade_subtitle,
           'city', pp.city,
           'is_online', pp.is_online,
           'portfolio_paths', to_jsonb(coalesce(k.proof_of_work_paths, '{}')),
           'portfolio_titles', to_jsonb(coalesce(k.proof_of_work_titles, '{}')),
           'completed_jobs', (select count(*) from public.bookings b
                               where b.provider_id = pp.user_id and b.status = 'completed')
         )
    into result
    from public.provider_profiles pp
    left join public.kyc_submissions k on k.user_id = pp.user_id
   where pp.user_id = p_provider
     and (pp.status = 'approved' or pp.user_id = uid);

  if result is null then raise exception 'Provider not found'; end if;
  return result;
end $$;

revoke execute on function public.get_provider_profile(text) from public, anon;
grant execute on function public.get_provider_profile(text) to authenticated;
