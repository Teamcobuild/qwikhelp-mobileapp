import type { SupabaseClient } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';

// Client side of the `payments` edge function (supabase/functions/payments). The app never marks a
// payment as successful itself: it opens Paystack checkout, then asks the server to verify.

export const PAYMENT_RETURN_URL = 'qwikhelp://payment-complete';
export const COMMISSION_RATE = 10; // percent, matches private.commission_for()

export async function callPayments<T = any>(supabase: SupabaseClient, action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('payments', { body: { action, ...body } });
  if (error) {
    let message = error.message;
    try {
      const res = await (error as any).context?.json?.();
      if (res?.error) message = res.error;
    } catch {}
    throw new Error(message);
  }
  return data as T;
}

export type PaymentOutcome = 'funded' | 'pending' | 'cancelled' | 'failed' | 'refund';

// Opens Paystack checkout for a booking and verifies the result with the server.
export async function payForBooking(supabase: SupabaseClient, bookingId: string, email: string): Promise<PaymentOutcome> {
  const { authorization_url, reference } = await callPayments<{ authorization_url: string; reference: string }>(supabase, 'init', {
    booking_id: bookingId,
    email,
  });

  const session = await WebBrowser.openAuthSessionAsync(authorization_url, PAYMENT_RETURN_URL);
  const returnedUrl = session.type === 'success' ? session.url : '';
  if (returnedUrl.includes('cancelled=1')) return 'cancelled';

  // Verify even if the browser was closed by hand: the customer may have paid before closing it.
  const result = await callPayments<{ result: string }>(supabase, 'verify', { reference });
  switch (result.result) {
    case 'funded':
    case 'already':
      return 'funded';
    case 'refund':
      return 'refund';
    case 'pending':
      return session.type === 'success' ? 'pending' : 'cancelled';
    default:
      return 'failed';
  }
}

// Commission maths shown to providers, mirrored from the database.
export const commissionFor = (amount: number) => Math.round(amount * (COMMISSION_RATE / 100));
export const earningFor = (amount: number) => amount - commissionFor(amount);
