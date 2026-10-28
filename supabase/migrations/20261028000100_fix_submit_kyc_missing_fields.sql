-- `missing || 'literal'` resolved the literal as text[] and raised "malformed array literal".
-- Use array_append so the incomplete-KYC message is built correctly.
create or replace function public.submit_kyc()
returns public.provider_status
language plpgsql security definer set search_path = public
as $$
declare
  uid text := public.requesting_user_id();
  p public.provider_profiles;
  k public.kyc_submissions;
  missing text[] := array[]::text[];
  next_status public.provider_status;
begin
  select * into p from public.provider_profiles where user_id = uid for update;
  if not found then raise exception 'Provider profile not found'; end if;
  if p.status not in ('draft', 'needs_changes') then return p.status; end if;

  select * into k from public.kyc_submissions where user_id = uid;
  if not found then raise exception 'KYC has not been started'; end if;

  if k.legal_name is null then missing := array_append(missing, 'legal name'); end if;
  if p.trade is null then missing := array_append(missing, 'trade'); end if;
  if k.id_type is null or k.document_number is null then missing := array_append(missing, 'ID document'); end if;
  if k.dob is null then missing := array_append(missing, 'date of birth'); end if;
  if k.id_image_path is null then missing := array_append(missing, 'ID photo'); end if;
  if k.selfie_path is null then missing := array_append(missing, 'selfie'); end if;
  if cardinality(k.proof_of_work_paths) = 0 then missing := array_append(missing, 'proof of work'); end if;
  if p.base_address is null then missing := array_append(missing, 'base address'); end if;
  if not k.sole_provider_agreed then missing := array_append(missing, 'terms agreement'); end if;
  if k.guarantor_name is null or k.guarantor_phone is null then missing := array_append(missing, 'guarantor'); end if;
  if not k.guarantor_consent_agreed then missing := array_append(missing, 'guarantor consent'); end if;

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
