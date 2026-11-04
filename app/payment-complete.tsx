import { Redirect } from 'expo-router';

// Paystack checkout returns to qwikhelp://payment-complete. Normally the in-app browser session catches it
// (lib/payments.ts verifies the payment); if the OS opens it as a route instead, just go to bookings,
// where the paid status shows once the server has verified it.
export default function PaymentComplete() {
  return <Redirect href="/(customer-tabs)/history" />;
}
