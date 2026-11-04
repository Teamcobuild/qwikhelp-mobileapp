import { EmptyJobsArt, EmptyState } from '@/components/illustrations/EmptyStates';
import { serviceName } from '@/constants/services';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { alertService } from '@/lib/AlertService';
import {
  BookingItem,
  BookingStatus,
  errorMessage,
  FeedItem,
  formatJobDate,
  formatJobTime,
  formatNaira,
} from '@/lib/broadcast';
import { CancelReasonModal } from '@/components/modals/CancelReasonModal';
import { callsComingSoon, openChat } from '@/lib/chat';
import { formatShortDate, formatTime } from '@/lib/dates';

const CHECK_IN_WINDOW_MS = 2 * 60 * 60 * 1000;
const checkInOpensAt = (b: BookingItem) => new Date(b.scheduled_at).getTime() - CHECK_IN_WINDOW_MS;
import { callPayments } from '@/lib/payments';
import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type JobStatusLabel =
  | 'Awaiting Payment'
  | 'Confirmed'
  | 'On the Way'
  | 'In Progress'
  | 'Awaiting Confirmation'
  | 'Completed'
  | 'Cancelled'
  | 'Disputed'
  | 'Pending Quote';

interface Job {
  id: string;
  jobId: string;
  offerId?: string;
  kind: 'booking' | 'quote';
  customerName: string;
  avatarBg: string;
  service: string;
  address: string;
  status: JobStatusLabel;
  date: string;
  amount: string;
  booking?: BookingItem;
}

const AVATAR_BGS = ['#B8E6CB', '#FED7AA', '#DDD6FE', '#BFDBFE', '#FBCFE8'];
const avatarBgFor = (name: string) => AVATAR_BGS[name.charCodeAt(0) % AVATAR_BGS.length];

const BOOKING_LABEL: Record<BookingStatus, JobStatusLabel> = {
  pending_payment: 'Awaiting Payment',
  confirmed: 'Confirmed',
  en_route: 'On the Way',
  in_progress: 'In Progress',
  awaiting_confirmation: 'Awaiting Confirmation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

const JOB_FILTERS = ['All', 'Active', 'Pending', 'Completed'] as const;

export default function Jobs() {
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabase();
  const [activeFilter, setActiveFilter] = useState<typeof JOB_FILTERS[number]>('All');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<BookingItem | null>(null);

  const load = useCallback(async () => {
    const [bookingsRes, feedRes] = await Promise.all([
      supabase.rpc('get_my_bookings'),
      supabase.rpc('get_provider_feed'),
    ]);
    if (bookingsRes.error) alertService.alert('Error', errorMessage(bookingsRes.error));

    const bookings = ((bookingsRes.data ?? []) as BookingItem[])
      .filter((b) => b.role === 'provider')
      .map<Job>((b) => ({
        id: `bk-${b.id}`,
        jobId: b.job_id,
        offerId: b.offer_id,
        kind: 'booking',
        customerName: b.customer_name,
        avatarBg: avatarBgFor(b.customer_name),
        service: serviceName(b.category),
        // The exact address is only sent once the customer has paid.
        address: b.address ?? b.landmark,
        status: BOOKING_LABEL[b.status],
        date: `${formatJobDate(b.scheduled_at)}, ${formatJobTime(b.scheduled_at)}`,
        amount: formatNaira(b.agreed_amount),
        booking: b,
      }));

    const quotes = ((feedRes.data ?? []) as FeedItem[])
      .filter((f) => f.offer)
      .map<Job>((f) => ({
        id: `q-${f.id}`,
        jobId: f.id,
        offerId: f.offer!.id,
        kind: 'quote',
        customerName: f.customer_name,
        avatarBg: avatarBgFor(f.customer_name),
        service: serviceName(f.category),
        address: `${f.landmark} • ${f.distance_km}km away`,
        status: 'Pending Quote',
        date: `${formatJobDate(f.scheduled_at)}, ${formatJobTime(f.scheduled_at)}`,
        amount: formatNaira(f.offer!.amount),
      }));

    setJobs([...quotes, ...bookings]);
    setLoading(false);
    setRefreshing(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(user ? `provider-jobs:${user.id}` : null, [
    { table: 'bookings', filter: `provider_id=eq.${user?.id}` },
    { table: 'offers', filter: `provider_id=eq.${user?.id}` },
  ], load);

  const filtered = jobs.filter((job) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Active') return ['Confirmed', 'On the Way', 'In Progress', 'Awaiting Confirmation'].includes(job.status);
    if (activeFilter === 'Pending') return job.status === 'Pending Quote' || job.status === 'Awaiting Payment';
    if (activeFilter === 'Completed') return job.status === 'Completed';
    return true;
  });

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'Confirmed':
      case 'On the Way':
      case 'In Progress':
        return { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]' };
      case 'Awaiting Confirmation':
        return { bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]' };
      case 'Pending Quote':
      case 'Awaiting Payment':
        return { bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]' };
      case 'Disputed':
        return { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]' };
      default:
        return { bg: 'bg-[#F3F4F6]', text: 'text-[#4B5563]' };
    }
  };

  // GPS check-in: the server only accepts it within 300m of the job address.
  const checkIn = async (b: BookingItem) => {
    setBusy(b.id);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alertService.alert('Location needed', 'Allow location so we can confirm you are at the job address.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { error } = await supabase.rpc('provider_arrived', {
        p_booking: b.id,
        p_lat: pos.coords.latitude,
        p_lng: pos.coords.longitude,
      });
      if (error) throw error;
      load();
    } catch (err) {
      alertService.alert("Couldn't check in", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const markDone = (b: BookingItem) => {
    alertService.alert('Mark job as done?', 'The customer will be asked to confirm. If they don\'t respond within 5 hours, payment is released to you automatically.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Mark done',
        onPress: async () => {
          setBusy(b.id);
          const { error } = await supabase.rpc('provider_mark_done', { p_booking: b.id });
          setBusy(null);
          if (error) alertService.alert('Error', errorMessage(error));
          else load();
        },
      },
    ]);
  };

  const cancelBooking = async (reason: string | null) => {
    if (!cancelling) return;
    setBusy(cancelling.id);
    try {
      await callPayments(supabase, 'cancel', { booking_id: cancelling.id, reason });
      setCancelling(null);
      alertService.alert('Booking cancelled', 'The customer has been notified and refunded in full.');
      load();
    } catch (err) {
      alertService.alert('Could not cancel', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const openMaps = (b: BookingItem) => {
    if (b.lat == null || b.lng == null) return;
    const label = encodeURIComponent(b.address ?? 'Job location');
    Linking.openURL(
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${b.lat},${b.lng}&q=${label}`
        : `geo:${b.lat},${b.lng}?q=${b.lat},${b.lng}(${label})`
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
      <ScrollView
        className="flex-1 px-4 pt-3"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mt-2 mb-4">
          <Text className="text-2xl font-bold text-gray-900">My Jobs</Text>
          <TouchableOpacity
            onPress={() => router.push('/messages')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="flex-row items-center bg-blue-50 px-3 py-1.5 rounded-full"
          >
            <Ionicons name="chatbubbles-outline" size={15} color="#1D4ED8" />
            <Text className="text-blue-700 text-xs font-bold ml-1.5">Messages</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {JOB_FILTERS.map((tab) => {
            const isActive = activeFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveFilter(tab)}
                activeOpacity={0.7}
                className={`py-2 px-4 rounded-xl mr-2.5 ${
                  isActive ? 'bg-blue-600' : 'bg-white'
                }`}
              >
                <Text
                  className={`text-xs ${
                    isActive ? 'text-white font-bold' : 'text-gray-600 font-medium'
                  }`}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Jobs List */}
        <View className="pb-10">
          {loading && <ActivityIndicator color="#2563EB" className="mt-10" />}
          {!loading && filtered.length === 0 && (
            <View className="bg-white rounded-[22px] py-6 my-4">
              <EmptyState
                art={<EmptyJobsArt width={180} />}
                title="No jobs yet"
                message="Jobs appear here once a customer books you or you send a quote."
              />
            </View>
          )}
          {filtered.map((job) => {
            const badge = getStatusBadge(job.status);
            return (
              <TouchableOpacity
                key={job.id}
                activeOpacity={job.kind === 'quote' ? 0.85 : 1}
                onPress={() => job.kind === 'quote' && router.push({ pathname: '/request/[jobId]', params: { jobId: job.jobId } })}
                className="bg-white rounded-[22px] p-4 mb-4"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-center flex-1 pr-2">
                    <View
                      style={{ backgroundColor: job.avatarBg }}
                      className="w-12 h-12 rounded-xl items-center justify-center overflow-hidden mr-3"
                    >
                      <Text className="text-lg font-bold text-gray-800">{job.customerName.charAt(0)}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                        {job.customerName}
                      </Text>
                      <Text className="text-xs text-gray-500 font-medium">{job.service} • {job.date}</Text>
                    </View>
                  </View>

                  <View className={`px-2.5 py-0.5 rounded-md ${badge.bg}`}>
                    <Text className={`text-[11px] font-bold ${badge.text}`}>{job.status}</Text>
                  </View>
                </View>

                {/* Details Row */}
                <View className="mt-3 pt-3 border-t border-gray-100 flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 pr-2">
                    <Ionicons name="location-sharp" size={13} color="#16A34A" />
                    <Text className="text-xs text-gray-600 ml-1 flex-1" numberOfLines={1}>
                      {job.address}
                    </Text>
                  </View>
                  <Text className="text-sm font-bold text-gray-900">{job.amount}</Text>
                </View>

                {job.booking && (
                  <BookingProgress
                    booking={job.booking}
                    busy={busy === job.booking.id}
                    onCheckIn={checkIn}
                    onMarkDone={markDone}
                    onCancel={setCancelling}
                    onOpenMaps={openMaps}
                  />
                )}

                {/* Action Buttons */}
                <View className="flex-row gap-2.5 mt-3 pt-2">
                  <TouchableOpacity
                    onPress={() => openChat(supabase, router, job.offerId)}
                    className="flex-1 bg-blue-50 py-2.5 rounded-xl items-center flex-row justify-center"
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color="#2563EB" />
                    <Text className="text-blue-600 font-bold text-xs ml-1.5">Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={callsComingSoon}
                    className="flex-1 bg-gray-50 py-2.5 rounded-xl items-center flex-row justify-center"
                  >
                    <Ionicons name="call-outline" size={15} color="#374151" />
                    <Text className="text-gray-700 font-bold text-xs ml-1.5">Call in App</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <CancelReasonModal
        visible={!!cancelling}
        role="provider"
        submitting={!!cancelling && busy === cancelling.id}
        refundNote={cancelling?.payment_status === 'paid' ? 'The customer will get a full refund.' : undefined}
        onClose={() => setCancelling(null)}
        onConfirm={cancelBooking}
      />
    </SafeAreaView>
  );
}

// Escrow status, the provider's share, and the next action for one booking.
function BookingProgress({ booking: b, busy, onCheckIn, onMarkDone, onCancel, onOpenMaps }: {
  booking: BookingItem;
  busy: boolean;
  onCheckIn: (b: BookingItem) => void;
  onMarkDone: (b: BookingItem) => void;
  onCancel: (b: BookingItem) => void;
  onOpenMaps: (b: BookingItem) => void;
}) {
  const paidStages = ['confirmed', 'en_route', 'in_progress', 'awaiting_confirmation'];
  return (
    <View className="mt-3 bg-gray-50 rounded-xl p-3">
      {b.status === 'pending_payment' && (
        <Text className="text-xs text-amber-700">The customer picked you and is paying now. The address unlocks once they pay.</Text>
      )}

      {(paidStages.includes(b.status) || b.status === 'completed') && (
        <View className="mb-2">
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-500">Job price</Text>
            <Text className="text-xs text-gray-700">{formatNaira(b.agreed_amount)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-500">QwikHelp fee (10%)</Text>
            <Text className="text-xs text-gray-700">-{formatNaira(b.commission_amount)}</Text>
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-xs font-bold text-gray-900">{b.status === 'completed' ? 'Paid to your wallet' : 'You earn (held in escrow)'}</Text>
            <Text className="text-xs font-bold text-gray-900">{formatNaira(b.provider_earning)}</Text>
          </View>
        </View>
      )}

      {paidStages.includes(b.status) && b.lat != null && (
        <TouchableOpacity onPress={() => onOpenMaps(b)} className="flex-row items-center mb-2">
          <Ionicons name="navigate" size={14} color="#2563EB" />
          <Text className="text-xs font-bold text-blue-600 ml-1">Get directions</Text>
        </TouchableOpacity>
      )}

      {(b.status === 'confirmed' || b.status === 'en_route') && (
        <>
          {checkInOpensAt(b) > Date.now() ? (
            // Matches provider_arrived(): check-in opens 2 hours before the start, so nobody can lock in early.
            <View className="bg-gray-200 rounded-xl py-2.5 items-center">
              <Text className="text-gray-600 font-bold text-sm">
                Check-in opens {formatShortDate(new Date(checkInOpensAt(b)))}, {formatTime(new Date(checkInOpensAt(b)))}
              </Text>
              <Text className="text-gray-500 text-[11px] mt-0.5">2 hours before the job, at the job address</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => onCheckIn(b)} disabled={busy} className="bg-green-600 rounded-xl py-2.5 items-center">
              {busy ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-sm">I&apos;ve arrived</Text>}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onCancel(b)} className="self-start pt-2">
            <Text className="text-red-600 font-semibold text-xs">Cancel this job</Text>
          </TouchableOpacity>
        </>
      )}

      {b.status === 'in_progress' && (
        <TouchableOpacity onPress={() => onMarkDone(b)} disabled={busy} className="bg-blue-600 rounded-xl py-2.5 items-center">
          {busy ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-sm">Mark job as done</Text>}
        </TouchableOpacity>
      )}

      {b.status === 'awaiting_confirmation' && b.auto_release_at && (
        <Text className="text-xs text-blue-700">
          Waiting for the customer to confirm. Payment is released automatically at {formatTime(b.auto_release_at)} if they don&apos;t respond.
        </Text>
      )}

      {b.status === 'cancelled' && (
        <Text className="text-xs text-gray-500">
          Cancelled{b.cancelled_by === 'customer' ? ' by the customer' : ''}{b.cancel_reason ? `: ${b.cancel_reason}` : ''}
        </Text>
      )}
    </View>
  );
}
