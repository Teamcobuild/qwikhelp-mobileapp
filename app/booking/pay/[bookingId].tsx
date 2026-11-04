import { serviceName } from '@/constants/services';
import { alertService } from '@/lib/AlertService';
import { BookingItem, errorMessage, formatJobDate, formatJobTime, formatNaira } from '@/lib/broadcast';
import { chatAvatar } from '@/lib/chat';
import { payForBooking } from '@/lib/payments';
import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const countdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// "Fund Escrow": the customer pays the agreed price; QwikHelp holds it until they confirm the job is done.
export default function PayScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const supabase = useSupabase();
  const { user } = useUser();

  const [booking, setBooking] = useState<BookingItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_booking', { p_booking: bookingId });
    if (error) setLoadError(errorMessage(error));
    else setBooking(data as BookingItem);
  }, [supabase, bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const msLeft = booking?.payment_due_at ? new Date(booking.payment_due_at).getTime() - now : 0;
  const expired = booking?.status === 'pending_payment' && msLeft <= 0;

  const pay = async () => {
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!booking || !email) return alertService.alert('Email needed', 'Add an email to your account to receive your receipt.');
    setPaying(true);
    try {
      const outcome = await payForBooking(supabase, booking.id, email);
      if (outcome === 'funded') {
        await load();
      } else if (outcome === 'refund') {
        alertService.alert('Booking no longer available', 'Your payment went through but the slot was taken, so we are refunding you in full.');
        router.replace('/(customer-tabs)/history');
      } else if (outcome === 'pending') {
        alertService.alert('Payment processing', 'Your bank is still confirming the payment. We\'ll notify you as soon as it\'s done.');
      } else if (outcome === 'failed') {
        alertService.alert('Payment failed', 'The payment didn\'t go through. You have not been charged. Please try again.');
      }
    } catch (err) {
      alertService.alert('Payment error', errorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  const changeProvider = () => {
    if (!booking) return;
    alertService.alert('Pick a different provider?', 'This releases the slot. You can choose another offer.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Change provider',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('cancel_payment_hold', { p_booking: booking.id });
          if (error) return alertService.alert('Error', errorMessage(error));
          router.replace({ pathname: '/booking/offers/[jobId]', params: { jobId: booking.job_id } });
        },
      },
    ]);
  };

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-8">
        {loadError ? (
          <>
            <Text className="text-gray-900 font-bold text-lg mb-2">Couldn&apos;t load this booking</Text>
            <Text className="text-gray-500 text-center mb-6">{loadError}</Text>
            <TouchableOpacity onPress={() => router.replace('/(customer-tabs)/history')} className="bg-blue-600 px-8 py-3 rounded-xl">
              <Text className="text-white font-bold">My bookings</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator size="large" color="#2563EB" />
        )}
      </SafeAreaView>
    );
  }

  const funded = booking.payment_status === 'paid';
  const providerFirst = booking.provider.name.split(' ')[0];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-gray-900">{funded ? 'Booking confirmed' : 'Fund Escrow'}</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Provider + job */}
        <View className="bg-white rounded-2xl p-4 mb-4 flex-row items-center">
          <Image source={{ uri: chatAvatar(booking.provider) }} className="w-12 h-12 rounded-full bg-gray-100 mr-3" />
          <View className="flex-1">
            <Text className="text-gray-900 font-bold text-base">{booking.provider.name}</Text>
            <Text className="text-gray-500 text-xs mt-0.5">
              {serviceName(booking.category)} • {formatJobDate(booking.scheduled_at)}, {formatJobTime(booking.scheduled_at)} • {booking.duration_hours}h
            </Text>
          </View>
        </View>

        {funded ? (
          <View className="bg-green-50 rounded-2xl p-5 mb-4 items-center">
            <Ionicons name="shield-checkmark" size={40} color="#16A34A" />
            <Text className="text-green-900 font-bold text-lg mt-2">{formatNaira(booking.agreed_amount)} held safely</Text>
            <Text className="text-green-800 text-sm text-center mt-1 leading-5">
              {providerFirst} now has your address and will check in when they arrive. We only release the money after you confirm the job is done.
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(customer-tabs)/history')} className="bg-green-600 rounded-xl py-3 px-8 mt-4">
              <Text className="text-white font-bold">View my bookings</Text>
            </TouchableOpacity>
          </View>
        ) : booking.status !== 'pending_payment' || expired ? (
          <View className="bg-white rounded-2xl p-5 mb-4 items-center">
            <Ionicons name="time-outline" size={32} color="#9CA3AF" />
            <Text className="text-gray-900 font-bold text-base mt-2">Payment window closed</Text>
            <Text className="text-gray-500 text-sm text-center mt-1">You can pick a provider again from your offers.</Text>
            <TouchableOpacity
              onPress={() => router.replace({ pathname: '/booking/offers/[jobId]', params: { jobId: booking.job_id } })}
              className="bg-blue-600 rounded-xl py-3 px-8 mt-4"
            >
              <Text className="text-white font-bold">Back to offers</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="flex-row items-center bg-amber-50 rounded-xl px-4 py-3 mb-4">
              <Ionicons name="timer-outline" size={18} color="#D97706" />
              <Text className="text-amber-900 text-sm ml-2 flex-1">
                {providerFirst}&apos;s slot is held for <Text className="font-bold">{countdown(msLeft)}</Text>. Pay to confirm.
              </Text>
            </View>

            {/* Breakdown */}
            <View className="bg-white rounded-2xl p-4 mb-4">
              <Row label="Workmanship (agreed price)" value={formatNaira(booking.agreed_amount)} />
              <Row label="Service fee" value="₦0" />
              <View className="h-px bg-gray-100 my-3" />
              <Row label="Total" value={formatNaira(booking.agreed_amount)} bold />
            </View>

            {/* Escrow explainer */}
            <View className="bg-blue-50 rounded-2xl p-4 mb-4">
              {[
                ['lock-closed', 'QwikHelp holds your payment. ' + providerFirst + ' is not paid yet.'],
                ['location', 'Your exact address is shared with ' + providerFirst + ' only after you pay.'],
                ['checkmark-done', 'Payment is released when you confirm the job is done (or 5 hours after they finish if you don\'t respond).'],
                ['refresh', 'Cancel before they arrive and you get a full refund.'],
              ].map(([icon, text]) => (
                <View key={icon} className="flex-row items-start mb-2">
                  <Ionicons name={icon as any} size={16} color="#2563EB" style={{ marginTop: 1 }} />
                  <Text className="text-blue-900 text-xs ml-2 flex-1 leading-4">{text}</Text>
                </View>
              ))}
            </View>

            <View className="flex-row items-start bg-gray-100 rounded-xl px-4 py-3 mb-6">
              <Ionicons name="construct-outline" size={16} color="#6B7280" style={{ marginTop: 1 }} />
              <Text className="text-gray-600 text-xs ml-2 flex-1 leading-4">
                Paying for materials and parts in the app is coming soon. For now this payment covers workmanship only.
              </Text>
            </View>

            <TouchableOpacity onPress={pay} disabled={paying} className="bg-blue-600 rounded-xl py-4 items-center mb-3">
              {paying ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Pay {formatNaira(booking.agreed_amount)} with Paystack</Text>
              )}
            </TouchableOpacity>
            <Text className="text-center text-[11px] text-gray-400 mb-4">Card, bank transfer or USSD</Text>

            <TouchableOpacity
              onPress={() => alertService.alert('Coming soon', 'Paying with OPay is coming soon. Please use Paystack for now.')}
              className="flex-row items-center justify-center bg-white border border-gray-200 rounded-xl py-4 mb-6"
            >
              <View className="bg-[#1DCF9F] rounded-md px-1.5 py-0.5 mr-2">
                <Text className="text-white font-extrabold text-xs">OPay</Text>
              </View>
              <Text className="text-gray-800 font-bold">Pay with OPay</Text>
              <Text className="text-gray-400 text-xs ml-2">Coming soon</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={changeProvider} className="items-center py-2">
              <Text className="text-gray-500 font-semibold">Pick a different provider</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className={bold ? 'text-gray-900 font-bold text-base' : 'text-gray-500 text-sm'}>{label}</Text>
      <Text className={bold ? 'text-gray-900 font-bold text-base' : 'text-gray-900 text-sm'}>{value}</Text>
    </View>
  );
}
