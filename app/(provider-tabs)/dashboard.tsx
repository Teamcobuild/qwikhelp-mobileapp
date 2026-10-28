import { alertService } from '@/lib/AlertService';
import { useNotifications } from '@/context/NotificationContext';
import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DashboardProfile {
  trade: string | null;
  city: string | null;
  is_online: boolean;
  rating: number;
  review_count: number;
}

interface JobItem {
  id: string;
  customerName: string;
  avatarBg: string;
  avatarSeed: string;
  status: 'Confirmed' | 'Pending Quote' | 'Upcoming' | 'Completed';
  category: 'Today' | 'Pending Quotes' | 'Upcoming';
  location: string;
  description: string;
  price?: string;
  phone?: string;
}

const INITIAL_JOBS: JobItem[] = [
  {
    id: '1',
    customerName: 'Nwabueze Chukwumamkpam Nwabueze',
    avatarBg: '#B8E6CB',
    avatarSeed: 'Nwabueze',
    status: 'Confirmed',
    category: 'Today',
    location: '70 Asa Road, Aba, Abia State',
    description: 'I want you to clean my house...',
    price: '₦25,000',
    phone: '+2348012345678',
  },
  {
    id: '2',
    customerName: 'Amaka Johnson',
    avatarBg: '#FED7AA',
    avatarSeed: 'Amaka',
    status: 'Pending Quote',
    category: 'Pending Quotes',
    location: '14 Okpara Avenue, Enugu, Enugu State',
    description: 'Electrical wiring inspection and inverter check for a 3-bedroom flat.',
    price: '₦35,000',
    phone: '+2348087654321',
  },
  {
    id: '3',
    customerName: 'Tunde Balogun',
    avatarBg: '#DDD6FE',
    avatarSeed: 'Tunde',
    status: 'Upcoming',
    category: 'Upcoming',
    location: '28 Victoria Island, Lagos State',
    description: 'Full house plumbing maintenance and kitchen sink replacement.',
    price: '₦45,000',
    phone: '+2348099887766',
  },
];

const FILTER_TABS = ['All', 'Pending Quotes', 'Today', 'Upcoming'] as const;
type FilterTab = typeof FILTER_TABS[number];

export default function Dashboard() {
  const { user } = useUser();
  const supabase = useSupabase();
  const router = useRouter();
  const { unreadCount } = useNotifications();

  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('All');

  // Modals
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedJobForActions, setSelectedJobForActions] = useState<JobItem | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: p, error }, { data: me }] = await Promise.all([
        supabase
          .from('provider_profiles')
          .select('trade, city, is_online, rating, review_count')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle(),
      ]);

      if (error && error.code !== 'PGRST116') {
        console.warn('Provider profile fetch error:', error.message);
      }
      setProfile(p);
      setOnline(p?.is_online ?? false);
      setAvatarUrl(me?.avatar_url ?? null);
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

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'Emeka';

  // Filter jobs
  const filteredJobs = INITIAL_JOBS.filter((job) => {
    if (selectedFilter === 'All') return true;
    return job.category === selectedFilter;
  });

  const getStatusBadgeStyle = (status: JobItem['status']) => {
    switch (status) {
      case 'Confirmed':
        return {
          bg: 'bg-[#DCFCE7]',
          text: 'text-[#16A34A]',
        };
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
            <View className="w-12 h-12 rounded-full bg-[#E0EDFF] items-center justify-center overflow-hidden border border-blue-100">
              <Image
                source={{
                  uri:
                    avatarUrl ||
                    user?.imageUrl ||
                    `https://api.dicebear.com/7.x/avataaars/png?seed=${firstName}&backgroundColor=dcebfe`,
                }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
            <Text className="text-[17px] font-bold text-gray-900 ml-3 flex-1" numberOfLines={1}>
              {getGreeting()}, {firstName}! 👋
            </Text>
          </View>

          {/* Right: Notification Bell */}
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 items-center justify-center relative shadow-xs"
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
          className="flex-row items-center bg-white border border-gray-300 rounded-xl px-3 py-1.5 mt-3 self-start shadow-xs"
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
            style={styles.card}
            className="w-[48%] bg-white rounded-[20px] border border-gray-200 p-4 h-[126px] justify-between mb-3.5"
          >
            <Text className="text-[13px] font-bold text-gray-900">Today’s Bookings</Text>
            <Text className="text-[28px] font-bold text-blue-600">12</Text>
          </View>

          {/* Card 2: Pending Quote's */}
          <View
            style={styles.card}
            className="w-[48%] bg-white rounded-[20px] border border-gray-200 p-4 h-[126px] justify-between mb-3.5"
          >
            <Text className="text-[13px] font-bold text-gray-900">Pending Quote’s</Text>
            <Text className="text-[28px] font-bold text-blue-600">2</Text>
          </View>

          {/* Card 3: Completed Bookings */}
          <View
            style={styles.card}
            className="w-[48%] bg-white rounded-[20px] border border-gray-200 p-4 h-[126px] justify-between mb-3.5"
          >
            <Text className="text-[13px] font-bold text-gray-900">Completed Bookings</Text>
            <Text className="text-[28px] font-bold text-blue-600">12</Text>
          </View>

          {/* Card 4: Account Balance (Navy Blue) */}
          <View
            style={styles.card}
            className="w-[48%] bg-[#0B3356] rounded-[20px] p-4 h-[126px] justify-between mb-3.5"
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
              {balanceVisible ? '₦100,000' : '₦••••••••'}
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
                className={`py-2.5 px-5 rounded-xl mr-2.5 ${
                  isActive ? 'bg-blue-600' : 'bg-white border border-gray-200'
                }`}
              >
                <Text
                  className={`text-sm ${
                    isActive ? 'text-white font-bold' : 'text-gray-500 font-medium'
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
            <View className="bg-white rounded-[22px] border border-gray-200 p-8 items-center justify-center my-4">
              <Ionicons name="document-text-outline" size={36} color="#9CA3AF" />
              <Text className="text-base font-bold text-gray-900 mt-3">No bookings found</Text>
              <Text className="text-xs text-gray-500 text-center mt-1">
                There are currently no bookings under the &quot;{selectedFilter}&quot; filter.
              </Text>
            </View>
          ) : (
            filteredJobs.map((job) => {
              const badge = getStatusBadgeStyle(job.status);
              return (
                <View
                  key={job.id}
                  style={styles.card}
                  className="bg-white rounded-[22px] border border-gray-200 p-4 mb-4"
                >
                  {/* Card Header: Avatar & Menu */}
                  <View className="flex-row items-start justify-between">
                    <View
                      style={{ backgroundColor: job.avatarBg }}
                      className="w-[68px] h-[68px] rounded-2xl items-center justify-center overflow-hidden"
                    >
                      <Image
                        source={{
                          uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${job.avatarSeed}&backgroundColor=${job.avatarBg.replace('#', '')}&facialHair=beardLight`,
                        }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
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

                  {/* Status Badge */}
                  <View className={`self-start px-2.5 py-0.5 rounded-md mt-1.5 ${badge.bg}`}>
                    <Text className={`text-xs font-bold ${badge.text}`}>{job.status}</Text>
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
                </View>
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
                  className={`flex-row items-center p-4 rounded-2xl mb-3 border ${
                    online ? 'border-emerald-500 bg-emerald-50/40' : 'border-gray-200 bg-white'
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
                  className={`flex-row items-center p-4 rounded-2xl mb-4 border ${
                    !online ? 'border-blue-600 bg-blue-50/40' : 'border-gray-200 bg-white'
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
                    if (job) router.push(`/chat/${job.id}` as any);
                  }}
                  className="flex-row items-center py-3.5 border-b border-gray-100"
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#2563EB" />
                  <Text className="text-sm font-bold text-gray-800 ml-3">Message Customer</Text>
                </TouchableOpacity>

                {/* Action: Call Customer */}
                {selectedJobForActions?.phone && (
                  <TouchableOpacity
                    onPress={() => {
                      const phone = selectedJobForActions.phone;
                      setSelectedJobForActions(null);
                      Linking.openURL(`tel:${phone}`);
                    }}
                    className="flex-row items-center py-3.5 border-b border-gray-100"
                  >
                    <Ionicons name="call-outline" size={20} color="#16A34A" />
                    <Text className="text-sm font-bold text-gray-800 ml-3">
                      Call {selectedJobForActions.phone}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Action: View Booking Details */}
                <TouchableOpacity
                  onPress={() => {
                    const job = selectedJobForActions;
                    setSelectedJobForActions(null);
                    alertService.alert(
                      'Booking Details',
                      `Client: ${job?.customerName}\nStatus: ${job?.status}\nLocation: ${job?.location}\nDescription: ${job?.description}`
                    );
                  }}
                  className="flex-row items-center py-3.5 border-b border-gray-100"
                >
                  <Ionicons name="information-circle-outline" size={20} color="#4B5563" />
                  <Text className="text-sm font-bold text-gray-800 ml-3">View Full Details</Text>
                </TouchableOpacity>

                {/* Action: Decline / Cancel */}
                <TouchableOpacity
                  onPress={() => {
                    setSelectedJobForActions(null);
                    alertService.alert(
                      'Decline Booking',
                      'Are you sure you want to decline this job request?',
                      [
                        { text: 'Keep Job', style: 'cancel' },
                        { text: 'Decline', style: 'destructive', onPress: () => {} },
                      ]
                    );
                  }}
                  className="flex-row items-center py-3.5"
                >
                  <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                  <Text className="text-sm font-bold text-red-600 ml-3">Decline Request</Text>
                </TouchableOpacity>

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

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
});
