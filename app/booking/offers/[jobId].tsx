import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Offer, OfferCard } from '../../../components/ui/OfferCard';
import { serviceName } from '../../../constants/services';
import { useRealtimeRefresh } from '../../../hooks/useRealtimeRefresh';
import { alertService } from '../../../lib/AlertService';
import {
  ACTIVE_OFFER_STATUSES,
  errorMessage,
  formatJobDate,
  formatJobTime,
  formatNaira,
  JobOffers,
} from '../../../lib/broadcast';
import { useSupabase } from '../../../lib/supabase';

export default function OffersScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();

  const [data, setData] = useState<JobOffers | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingOfferId, setBookingOfferId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) return;
    const { data: result, error } = await supabase.rpc('get_job_offers', { p_job: jobId });
    if (error) setLoadError(errorMessage(error));
    else {
      setData(result as JobOffers);
      setLoadError(null);
    }
    setRefreshing(false);
  }, [supabase, jobId]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(jobId ? `job-offers:${jobId}` : null, [
    { table: 'offers', filter: `job_id=eq.${jobId}` },
    { table: 'jobs', filter: `id=eq.${jobId}` },
  ], load);

  const goHome = () => router.replace('/(customer-tabs)/home');

  const handleBook = (offer: Offer) => {
    alertService.alert(
      `Book ${offer.provider.name.split(' ')[0]}?`,
      `${formatNaira(offer.amount)} workmanship fee. All other offers will be closed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Book',
          onPress: async () => {
            setBookingOfferId(offer.id);
            try {
              const { data: result, error } = await supabase.rpc('select_offer', { p_offer: offer.id });
              if (error) throw error;
              if (!result.ok) {
                alertService.alert(
                  'Provider Unavailable',
                  'This provider just got booked for an overlapping job. Please choose another offer.'
                );
              }
              await load();
            } catch (err) {
              alertService.alert('Booking Failed', errorMessage(err));
            } finally {
              setBookingOfferId(null);
            }
          },
        },
      ]
    );
  };

  const handleCancelJob = () => {
    alertService.alert('Cancel Request?', 'Providers will stop seeing this job and all offers will close.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('cancel_job', { p_job: jobId });
          if (error) alertService.alert('Error', errorMessage(error));
          else goHome();
        },
      },
    ]);
  };

  if (!data) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-8">
        {loadError ? (
          <>
            <Text className="text-gray-900 font-bold text-lg mb-2">Couldn&apos;t load offers</Text>
            <Text className="text-gray-500 text-center mb-6">{loadError}</Text>
            <TouchableOpacity onPress={load} className="bg-blue-600 px-8 py-3 rounded-xl">
              <Text className="text-white font-bold">Try again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator size="large" color="#2563EB" />
        )}
      </SafeAreaView>
    );
  }

  const { job, offers } = data;
  const isOpen = job.status === 'open';
  const selected = offers.find((o) => o.status === 'selected');
  const activeOffers = offers.filter((o) => ACTIVE_OFFER_STATUSES.includes(o.status));
  const closedOffers = offers.filter((o) => !ACTIVE_OFFER_STATUSES.includes(o.status) && o.status !== 'selected');

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-6 py-4">
        <TouchableOpacity onPress={goHome} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="w-10 h-10 items-center justify-center -ml-2">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-gray-900">
          Offers For your Job
        </Text>
        {/* Balances the back button so the title stays centred without covering it. */}
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Job Summary Card */}
        <View className="bg-white rounded-2xl p-4 mb-6 shadow-sm shadow-gray-100">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center flex-1">
              <Text className="text-gray-400 font-medium mr-2">Service:</Text>
              <Text className="text-gray-900 font-bold" numberOfLines={1}>
                {serviceName(job.category)}{job.sub_category ? ` • ${job.sub_category}` : ''}
              </Text>
            </View>
            <JobStatusPill status={job.status} />
          </View>

          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-600 font-medium">{job.duration_hours} Hours</Text>
            <Text className="text-gray-600 font-medium">{formatJobDate(job.scheduled_at)}</Text>
            <Text className="text-gray-600 font-medium">{formatJobTime(job.scheduled_at)}</Text>
          </View>

          <View className="flex-row items-center mb-1">
            <Ionicons name="location-outline" size={14} color="#9ca3af" />
            <Text className="text-gray-500 text-xs ml-1 flex-1" numberOfLines={1}>{job.landmark}</Text>
          </View>

          <View className="flex-row items-center justify-between border-t border-gray-100 pt-4 mt-3">
            <View className="flex-row items-center">
              <Text className="text-gray-400 font-medium mr-2">Budget:</Text>
              <Text className="text-gray-900 font-bold text-lg">{formatNaira(job.budget)}</Text>
            </View>
            {isOpen && (
              <TouchableOpacity onPress={handleCancelJob} className="border border-red-200 px-4 py-2 rounded-xl">
                <Text className="text-red-600 font-bold">Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Booked */}
        {selected && (
          <View className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6">
            <View className="flex-row items-center mb-1">
              <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
              <Text className="text-green-800 font-bold text-base ml-2">Booking confirmed</Text>
            </View>
            <Text className="text-green-900 text-sm leading-5">
              {selected.provider.name} will do this job for {formatNaira(selected.amount)} on{' '}
              {formatJobDate(job.scheduled_at)} at {formatJobTime(job.scheduled_at)}.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(customer-tabs)/history')}
              className="bg-green-600 py-3 rounded-xl items-center mt-4"
            >
              <Text className="text-white font-bold">View My Bookings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Searching / closed states */}
        {isOpen && activeOffers.length === 0 && (
          <View className="bg-white rounded-2xl p-6 items-center mb-6">
            <ActivityIndicator color="#2563EB" />
            <Text className="text-gray-900 font-bold text-base mt-4">Finding providers…</Text>
            <Text className="text-gray-500 text-xs text-center mt-1 leading-4">
              {data.dispatched_count > 0
                ? `${data.dispatched_count} verified provider${data.dispatched_count === 1 ? '' : 's'} within ${job.search_radius_km}km can see your request.`
                : `No providers are online within ${job.search_radius_km}km yet. We'll keep looking and widen the search.`}
            </Text>
            <Text className="text-gray-400 text-[11px] mt-3">Open until {formatJobTime(job.expires_at)}</Text>
          </View>
        )}
        {(job.status === 'expired' || job.status === 'cancelled') && (
          <View className="bg-white rounded-2xl p-6 items-center mb-6">
            <Ionicons name="time-outline" size={28} color="#9ca3af" />
            <Text className="text-gray-900 font-bold text-base mt-2">
              {job.status === 'expired' ? 'This request expired' : 'You cancelled this request'}
            </Text>
            <TouchableOpacity onPress={goHome} className="bg-blue-600 px-6 py-3 rounded-xl mt-4">
              <Text className="text-white font-bold">Post a New Request</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Offers List (neutral order: price, then rating, then distance) */}
        <View className="pb-24">
          {activeOffers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              budget={job.budget}
              onBook={handleBook}
              booking={bookingOfferId === offer.id}
              disabled={!isOpen || (!!bookingOfferId && bookingOfferId !== offer.id)}
            />
          ))}
          {closedOffers.length > 0 && (
            <Text className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-3 mt-2">Closed offers</Text>
          )}
          {closedOffers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} budget={job.budget} onBook={handleBook} disabled />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function JobStatusPill({ status }: { status: JobOffers['job']['status'] }) {
  const styles = {
    open: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Live' },
    booked: { bg: 'bg-green-100', text: 'text-green-700', label: 'Booked' },
    expired: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Expired' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Cancelled' },
  }[status];
  return (
    <View className={`px-2.5 py-0.5 rounded-full ml-2 ${styles.bg}`}>
      <Text className={`text-[11px] font-bold ${styles.text}`}>{styles.label}</Text>
    </View>
  );
}
