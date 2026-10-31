import { useAvatar } from '@/context/AvatarContext';
import { useNotifications } from '@/context/NotificationContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { alertService } from '@/lib/AlertService';
import {
  BookingItem,
  errorMessage,
  FeedItem,
  formatJobDate,
  formatJobTime,
  formatNaira,
} from '@/lib/broadcast';
import { callsComingSoon, openChat } from '@/lib/chat';
import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DashboardProfile {
  trade: string | null;
  city: string | null;
  is_online: boolean;
  rating: number;
  review_count: number;
}

type JobCardStatus = 'New Request' | 'Pending Quote' | 'Final Offer' | 'Agreed' | 'Confirmed' | 'Upcoming' | 'Completed';

interface JobItem {
  id: string;
  kind: 'request' | 'booking';
  jobId: string;
  offerId?: string;
  customerName: string;
  avatarBg: string;
  status: JobCardStatus;
  category: 'New Requests' | 'Pending Quotes' | 'Today' | 'Upcoming' | 'Past';
  location: string;
  description: string;
  price: string;
  when: string;
}

const AVATAR_BGS = ['#B8E6CB', '#FED7AA', '#DDD6FE', '#BFDBFE', '#FBCFE8'];
const avatarBgFor = (name: string) => AVATAR_BGS[name.charCodeAt(0) % AVATAR_BGS.length];

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function feedToJob(f: FeedItem): JobItem {
  const status: JobCardStatus = !f.offer
    ? 'New Request'
    : f.offer.status === 'agreed'
      ? 'Agreed'
      : f.offer.status === 'awaiting_provider'
        ? 'Final Offer'
        : 'Pending Quote';
  return {
    id: `req-${f.id}`,
    kind: 'request',
    jobId: f.id,
    offerId: f.offer?.id,
    customerName: f.customer_name,
    avatarBg: avatarBgFor(f.customer_name),
    status,
    category: f.offer ? 'Pending Quotes' : 'New Requests',
    location: `${f.landmark} • ${f.distance_km}km away`,
    description: f.description,
    price: formatNaira(f.offer?.amount ?? f.budget),
    when: `${formatJobDate(f.scheduled_at)}, ${formatJobTime(f.scheduled_at)}`,
  };
}

function bookingToJob(b: BookingItem): JobItem {
  const done = b.status === 'completed' || b.status === 'cancelled';
  return {
    id: `bk-${b.id}`,
    kind: 'booking',
    jobId: b.job_id,
    offerId: b.offer_id,
    customerName: b.customer_name,
    avatarBg: avatarBgFor(b.customer_name),
    status: b.status === 'completed' ? 'Completed' : isToday(b.scheduled_at) ? 'Confirmed' : 'Upcoming',
    category: done ? 'Past' : isToday(b.scheduled_at) ? 'Today' : 'Upcoming',
    location: b.landmark,
    description: b.description,
    price: formatNaira(b.agreed_amount),
    when: `${formatJobDate(b.scheduled_at)}, ${formatJobTime(b.scheduled_at)}`,
  };
}

const FILTER_TABS = ['All', 'New Requests', 'Pending Quotes', 'Today', 'Upcoming'] as const;
type FilterTab = typeof FILTER_TABS[number];

export default function Dashboard() {
  const { user } = useUser();
  const supabase = useSupabase();
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const { avatarUrl, reload: reloadAvatar } = useAvatar();

  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('All');

  // Modals
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedJobForActions, setSelectedJobForActions] = useState<JobItem | null>(null);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const knownRequests = useRef<Set<string> | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: p, error }, feedRes, bookingsRes] = await Promise.all([
        supabase
          .from('provider_profiles')
          .select('trade, city, is_online, rating, review_count')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.rpc('get_provider_feed'),
        supabase.rpc('get_my_bookings'),
      ]);

      if (error && error.code !== 'PGRST116') {
        console.warn('Provider profile fetch error:', error.message);
      }
      setProfile(p);
      setOnline(p?.is_online ?? false);

      if (feedRes.error) console.warn('Feed error:', errorMessage(feedRes.error));
      const nextFeed = (feedRes.data ?? []) as FeedItem[];
      // Buzz when a new request arrives while the dashboard is open (not on first load).
      const ids = new Set(nextFeed.map((f) => f.id));
      if (knownRequests.current && nextFeed.some((f) => !knownRequests.current!.has(f.id))) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      knownRequests.current = ids;
      setFeed(nextFeed);

      if (bookingsRes.error) console.warn('Bookings error:', errorMessage(bookingsRes.error));
      setBookings(((bookingsRes.data ?? []) as BookingItem[]).filter((b) => b.role === 'provider'));
    } catch (err: any) {
      console.warn('Load dashboard error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeRefresh(user ? `provider-dashboard:${user.id}` : null, [
    { table: 'job_dispatches', filter: `provider_id=eq.${user?.id}` },
    { table: 'offers', filter: `provider_id=eq.${user?.id}` },
    { table: 'bookings', filter: `provider_id=eq.${user?.id}` },
  ], loadData);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    reloadAvatar();
  };

  const handleUpdateStatus = async (nextOnline: boolean) => {
    setStatusModalVisible(false);
    setOnline(nextOnline);
    if (!user) return;
    try {
      const { error } = await supabase
        .from('provider_profiles')
        .update({ is_online: nextOnline })
        .eq('user_id', user.id);
      if (error) {
        setOnline(!nextOnline);
        alertService.alert('Error', error.message);
      }
    } catch (err: any) {
      setOnline(!nextOnline);
      alertService.alert('Error', err.message || 'Failed to update status');
    }
  };

  // Determine greeting based on local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || '';

  const allJobs = useMemo(
    () => [...feed.map(feedToJob), ...bookings.map(bookingToJob).filter((j) => j.category !== 'Past')],
    [feed, bookings]
  );

  const metrics = useMemo(() => ({
    today: bookings.filter((b) => isToday(b.scheduled_at) && b.status !== 'cancelled').length,
    pendingQuotes: feed.filter((f) => f.offer).length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    // Becomes the wallet balance once Paystack payouts are wired up.
    balance: bookings
      .filter((b) => b.status === 'completed' && b.payment_status === 'paid')
      .reduce((sum, b) => sum + b.agreed_amount, 0),
  }), [feed, bookings]);

  // Filter jobs
  const filteredJobs = allJobs.filter((job) => {
    if (selectedFilter === 'All') return true;
    return job.category === selectedFilter;
  });

  const openJob = (job: JobItem) => {
    if (job.kind === 'request') router.push({ pathname: '/request/[jobId]', params: { jobId: job.jobId } });
    else router.push('/(provider-tabs)/jobs');
  };

  const declineJob = async (job: JobItem) => {
    const { error } = job.offerId
      ? await supabase.rpc('withdraw_offer', { p_offer: job.offerId })
      : await supabase.rpc('dismiss_job', { p_job: job.jobId });
    if (error) alertService.alert('Error', errorMessage(error));
    loadData();
  };

  const getStatusBadgeStyle = (status: JobItem['status']) => {
    switch (status) {
      case 'New Request':
        return {
          bg: 'bg-[#DBEAFE]',
          text: 'text-[#2563EB]',
        };
      case 'Agreed':
      case 'Confirmed':
        return {
          bg: 'bg-[#DCFCE7]',
          text: 'text-[#16A34A]',
        };
      case 'Final Offer':
      case 'Pending Quote':
        return {
          bg: 'bg-[#FEF3C7]',
          text: 'text-[#D97706]',
        };
      case 'Upcoming':
        return {
          bg: 'bg-[#E0E7FF]',
          text: 'text-[#4F46E5]',
        };
      case 'Completed':
        return {
          bg: 'bg-[#F3F4F6]',
          text: 'text-[#4B5563]',
        };
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
      <ScrollView
        className="flex-1 px-4 pt-2"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Top Header */}
        <View className="flex-row items-center justify-between mt-2">
          {/* Left: Avatar & Greeting */}
          <View className="flex-row items-center flex-1 pr-3">
            <View className="w-12 h-12 rounded-full bg-[#E0EDFF] items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <Ionicons name="person" size={22} color="#2563EB" />
              )}
            </View>
            <Text className="text-[17px] font-bold text-gray-900 ml-3 flex-1" numberOfLines={1}>
              {getGreeting()}, {firstName}! 👋
            </Text>
          </View>

          {/* Right: Notification Bell */}
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-full bg-white items-center justify-center relative"
          >
            <Ionicons name="notifications-outline" size={20} color="#111827" />
            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 border-2 border-white">
                <Text className="text-white text-[9px] font-bold">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Availability Status Dropdown Pill */}
        <TouchableOpacity
          onPress={() => setStatusModalVisible(true)}
          activeOpacity={0.7}
          className="flex-row items-center bg-white rounded-xl px-3 py-1.5 mt-3 self-start"
        >
          {online ? (
            <View className="w-3.5 h-3.5 rounded-full border border-emerald-400 items-center justify-center mr-2 bg-emerald-50">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </View>
          ) : (
            <View className="w-3.5 h-3.5 rounded-full border border-gray-400 items-center justify-center mr-2 bg-gray-50">
              <View className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            </View>
          )}
          <Text className="text-xs font-bold text-gray-800 mr-2">
            {online ? 'Active' : 'Inactive'}
          </Text>
          <Ionicons name="caret-down-sharp" size={10} color="#374151" />
        </TouchableOpacity>

        {/* 2x2 Metric Cards Grid */}
        <View className="flex-row flex-wrap justify-between mt-4">
          {/* Card 1: Today's Bookings */}
          <View
            className="w-[48%] bg-white rounded-[20px] p-4 h-[126px] justify-between mb-3.5"
          >
            <Text className="text-[13px] font-bold text-gray-900">Today’s Bookings</Text>
            <Text className="text-[28px] font-bold text-blue-600">{metrics.today}</Text>
          </View>

          {/* Card 2: Pending Quote's */}
          <View
            className="w-[48%] bg-white rounded-[20px] p-4 h-[126px] justify-between mb-3.5"
          >
            <Text className="text-[13px] font-bold text-gray-900">Pending Quote’s</Text>
            <Text className="text-[28px] font-bold text-blue-600">{metrics.pendingQuotes}</Text>
          </View>

          {/* Card 3: Completed Bookings */}
          <View
            className="w-[48%] bg-white rounded-[20px] p-4 h-[126px] justify-between mb-3.5"
          >
            <Text className="text-[13px] font-bold text-gray-900">Completed Bookings</Text>
            <Text className="text-[28px] font-bold text-blue-600">{metrics.completed}</Text>
          </View>

          {/* Card 4: Account Balance (Navy Blue) */}
          <View
            className="w-[48%] bg-blue-600 rounded-[20px] p-4 h-[126px] justify-between mb-3.5"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] font-bold text-white">Account Balance</Text>
              <TouchableOpacity
                onPress={() => setBalanceVisible(!balanceVisible)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color="white"
                />
              </TouchableOpacity>
            </View>
            <Text className="text-[22px] font-bold text-white tracking-tight" numberOfLines={1}>
              {balanceVisible ? formatNaira(metrics.balance) : '₦••••••••'}
            </Text>
          </View>
        </View>

        {/* Filter Tabs Horizontal Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-2 mb-4"
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = selectedFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setSelectedFilter(tab)}
                activeOpacity={0.7}
                className={`py-2.5 px-5 rounded-xl mr-2.5 ${isActive ? 'bg-blue-600' : 'bg-white'
                  }`}
              >
                <Text
                  className={`text-sm ${isActive ? 'text-white font-bold' : 'text-gray-500 font-medium'
                    }`}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Bookings / Jobs Feed */}
        <View className="pb-10">
          {filteredJobs.length === 0 ? (
            <View className="bg-white rounded-[22px] p-8 items-center justify-center my-4">
              <Ionicons name="document-text-outline" size={36} color="#9CA3AF" />
              <Text className="text-base font-bold text-gray-900 mt-3">
                {selectedFilter === 'New Requests' || selectedFilter === 'All' ? 'No requests yet' : 'No bookings found'}
              </Text>
              <Text className="text-xs text-gray-500 text-center mt-1">
                {online
                  ? `Nothing under "${selectedFilter}" right now. New job requests near you will appear here.`
                  : 'You are offline. Set yourself Active to receive job requests near you.'}
              </Text>
            </View>
          ) : (
            filteredJobs.map((job) => {
              const badge = getStatusBadgeStyle(job.status);
              return (
                <TouchableOpacity
                  key={job.id}
                  activeOpacity={0.85}
                  onPress={() => openJob(job)}
                  className="bg-white rounded-[22px] p-4 mb-4"
                >
                  {/* Card Header: Avatar & Menu */}
                  <View className="flex-row items-start justify-between">
                    <View
                      style={{ backgroundColor: job.avatarBg }}
                      className="w-[68px] h-[68px] rounded-2xl items-center justify-center overflow-hidden"
                    >
                      <Text className="text-[26px] font-bold text-gray-800">{job.customerName.charAt(0)}</Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => setSelectedJobForActions(job)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      className="p-1"
                    >
                      <Ionicons name="ellipsis-vertical" size={20} color="#1F2937" />
                    </TouchableOpacity>
                  </View>

                  {/* Customer Name */}
                  <Text className="text-[16px] font-bold text-gray-900 mt-3" numberOfLines={1}>
                    {job.customerName}
                  </Text>

                  {/* Status Badge & Price */}
                  <View className="flex-row items-center justify-between mt-1.5">
                    <View className={`px-2.5 py-0.5 rounded-md ${badge.bg}`}>
                      <Text className={`text-xs font-bold ${badge.text}`}>{job.status}</Text>
                    </View>
                    <Text className="text-sm font-bold text-blue-600">{job.price}</Text>
                  </View>

                  {/* Location Row */}
                  <View className="flex-row items-center mt-2.5">
                    <Ionicons name="location-sharp" size={14} color="#16A34A" />
                    <Text className="text-xs font-semibold text-gray-800 ml-1.5 flex-1" numberOfLines={1}>
                      {job.location}
                    </Text>
                  </View>

                  {/* Description */}
                  <Text className="text-sm font-medium text-gray-900 mt-2 leading-5" numberOfLines={2}>
                    {job.description}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1.5">{job.when}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Availability Status Selection Modal */}
      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setStatusModalVisible(false)}>
          <View className="flex-1 bg-black/40 justify-end">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-t-3xl p-6 pb-10">
                <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-5" />
                <Text className="text-lg font-bold text-gray-900 mb-1">Set Availability Status</Text>
                <Text className="text-xs text-gray-500 mb-5">
                  Choose whether you want to receive new booking requests and client quotes.
                </Text>

                {/* Option: Active */}
                <TouchableOpacity
                  onPress={() => handleUpdateStatus(true)}
                  activeOpacity={0.7}
                  className={`flex-row items-center p-4 rounded-2xl mb-3 border ${online ? 'border-emerald-500 bg-emerald-50/40' : 'border-gray-200 bg-white'
                    }`}
                >
                  <View className="w-4 h-4 rounded-full border border-emerald-500 items-center justify-center mr-3 bg-emerald-100">
                    <View className="w-2 h-2 rounded-full bg-emerald-600" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900">Active (Online)</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">
                      You are visible to clients and will receive new bookings near you.
                    </Text>
                  </View>
                  {online && <Ionicons name="checkmark-circle" size={20} color="#059669" />}
                </TouchableOpacity>

                {/* Option: Inactive */}
                <TouchableOpacity
                  onPress={() => handleUpdateStatus(false)}
                  activeOpacity={0.7}
                  className={`flex-row items-center p-4 rounded-2xl mb-4 border ${!online ? 'border-blue-600 bg-blue-50/40' : 'border-gray-200 bg-white'
                    }`}
                >
                  <View className="w-4 h-4 rounded-full border border-gray-400 items-center justify-center mr-3 bg-gray-100">
                    <View className="w-2 h-2 rounded-full bg-gray-500" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900">Inactive (Offline)</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">
                      Take a break. You will not receive new incoming notifications.
                    </Text>
                  </View>
                  {!online && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
                </TouchableOpacity>

                {/* Close Button */}
                <TouchableOpacity
                  onPress={() => setStatusModalVisible(false)}
                  className="bg-gray-100 py-3.5 rounded-xl items-center mt-2"
                >
                  <Text className="text-sm font-bold text-gray-700">Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Job Card Quick Actions Modal */}
      <Modal
        visible={!!selectedJobForActions}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedJobForActions(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedJobForActions(null)}>
          <View className="flex-1 bg-black/40 justify-end">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-t-3xl p-6 pb-10">
                <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-5" />
                <Text className="text-base font-bold text-gray-900 mb-1" numberOfLines={1}>
                  {selectedJobForActions?.customerName}
                </Text>
                <Text className="text-xs text-gray-500 mb-5">
                  {selectedJobForActions?.location}
                </Text>

                {/* Action: Message Customer */}
                <TouchableOpacity
                  onPress={() => {
                    const job = selectedJobForActions;
                    setSelectedJobForActions(null);
                    openChat(supabase, router, job?.offerId);
                  }}
                  className="flex-row items-center py-3.5 border-b border-gray-100"
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#2563EB" />
                  <Text className="text-sm font-bold text-gray-800 ml-3">Message Customer</Text>
                </TouchableOpacity>

                {/* Action: In-app Call (no phone numbers are shared) */}
                <TouchableOpacity
                  onPress={() => {
                    setSelectedJobForActions(null);
                    callsComingSoon();
                  }}
                  className="flex-row items-center py-3.5 border-b border-gray-100"
                >
                  <Ionicons name="call-outline" size={20} color="#16A34A" />
                  <Text className="text-sm font-bold text-gray-800 ml-3">Call in App</Text>
                </TouchableOpacity>

                {/* Action: View Details */}
                <TouchableOpacity
                  onPress={() => {
                    const job = selectedJobForActions;
                    setSelectedJobForActions(null);
                    if (job) openJob(job);
                  }}
                  className="flex-row items-center py-3.5 border-b border-gray-100"
                >
                  <Ionicons name="information-circle-outline" size={20} color="#4B5563" />
                  <Text className="text-sm font-bold text-gray-800 ml-3">View Full Details</Text>
                </TouchableOpacity>

                {/* Action: Decline / Withdraw (requests only; bookings are managed from Jobs) */}
                {selectedJobForActions?.kind === 'request' && (
                  <TouchableOpacity
                    onPress={() => {
                      const job = selectedJobForActions;
                      setSelectedJobForActions(null);
                      alertService.alert(
                        job.offerId ? 'Withdraw Offer' : 'Decline Request',
                        job.offerId
                          ? 'The customer will no longer be able to book you for this job.'
                          : 'This request will be removed from your dashboard.',
                        [
                          { text: 'Keep Job', style: 'cancel' },
                          { text: job.offerId ? 'Withdraw' : 'Decline', style: 'destructive', onPress: () => declineJob(job) },
                        ]
                      );
                    }}
                    className="flex-row items-center py-3.5"
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                    <Text className="text-sm font-bold text-red-600 ml-3">
                      {selectedJobForActions.offerId ? 'Withdraw Offer' : 'Decline Request'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Close Button */}
                <TouchableOpacity
                  onPress={() => setSelectedJobForActions(null)}
                  className="bg-gray-100 py-3.5 rounded-xl items-center mt-4"
                >
                  <Text className="text-sm font-bold text-gray-700">Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}
