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
import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type JobStatusLabel = 'Confirmed' | 'On the Way' | 'In Progress' | 'Completed' | 'Cancelled' | 'Disputed' | 'Pending Quote';

interface Job {
  id: string;
  jobId: string;
  kind: 'booking' | 'quote';
  customerName: string;
  avatarBg: string;
  service: string;
  address: string;
  status: JobStatusLabel;
  date: string;
  amount: string;
}

const AVATAR_BGS = ['#B8E6CB', '#FED7AA', '#DDD6FE', '#BFDBFE', '#FBCFE8'];
const avatarBgFor = (name: string) => AVATAR_BGS[name.charCodeAt(0) % AVATAR_BGS.length];

const BOOKING_LABEL: Record<BookingStatus, JobStatusLabel> = {
  confirmed: 'Confirmed',
  en_route: 'On the Way',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

const JOB_FILTERS = ['All', 'Active', 'Pending', 'Completed'] as const;

// In-app chat and calls only; phone numbers are never shared.
const comingSoon = () =>
  alertService.alert('Coming Soon', 'In-app chat and calls with customers are coming in the next update.');

export default function Jobs() {
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabase();
  const [activeFilter, setActiveFilter] = useState<typeof JOB_FILTERS[number]>('All');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        kind: 'booking',
        customerName: b.customer_name,
        avatarBg: avatarBgFor(b.customer_name),
        service: serviceName(b.category),
        address: b.landmark,
        status: BOOKING_LABEL[b.status],
        date: `${formatJobDate(b.scheduled_at)}, ${formatJobTime(b.scheduled_at)}`,
        amount: formatNaira(b.agreed_amount),
      }));

    const quotes = ((feedRes.data ?? []) as FeedItem[])
      .filter((f) => f.offer)
      .map<Job>((f) => ({
        id: `q-${f.id}`,
        jobId: f.id,
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
    if (activeFilter === 'Active') return ['Confirmed', 'On the Way', 'In Progress'].includes(job.status);
    if (activeFilter === 'Pending') return job.status === 'Pending Quote';
    if (activeFilter === 'Completed') return job.status === 'Completed';
    return true;
  });

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'Confirmed':
      case 'On the Way':
      case 'In Progress':
        return { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]' };
      case 'Pending Quote':
        return { bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]' };
      case 'Disputed':
        return { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]' };
      default:
        return { bg: 'bg-[#F3F4F6]', text: 'text-[#4B5563]' };
    }
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
          <View className="bg-blue-50 px-3 py-1 rounded-full">
            <Text className="text-blue-700 text-xs font-bold">{jobs.length} Total</Text>
          </View>
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
            <View className="bg-white rounded-[22px] p-8 items-center justify-center my-4">
              <Ionicons name="briefcase-outline" size={36} color="#9CA3AF" />
              <Text className="text-base font-bold text-gray-900 mt-3">No jobs yet</Text>
              <Text className="text-xs text-gray-500 text-center mt-1">
                Jobs appear here once a customer books you or you send a quote.
              </Text>
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

                {/* Action Buttons */}
                <View className="flex-row gap-2.5 mt-3 pt-2">
                  <TouchableOpacity
                    onPress={comingSoon}
                    className="flex-1 bg-blue-50 py-2.5 rounded-xl items-center flex-row justify-center"
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color="#2563EB" />
                    <Text className="text-blue-600 font-bold text-xs ml-1.5">Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={comingSoon}
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
    </SafeAreaView>
  );
}
