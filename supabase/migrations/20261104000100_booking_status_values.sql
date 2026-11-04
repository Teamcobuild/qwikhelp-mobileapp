-- New booking states for escrow payments. Kept in their own migration: Postgres can't use a new enum
-- value in the same transaction that adds it.
--   pending_payment       customer picked a provider; slot held while they pay
--   awaiting_confirmation provider marked the job done; customer confirms (or it auto-releases)
alter type public.booking_status add value if not exists 'pending_payment' before 'confirmed';
alter type public.booking_status add value if not exists 'awaiting_confirmation' after 'in_progress';
