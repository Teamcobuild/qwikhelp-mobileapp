import { serviceName } from '@/constants/services';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { alertService } from '@/lib/AlertService';
import { BookingItem, errorMessage, formatJobDate, formatJobTime, formatNaira } from '@/lib/broadcast';
import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Payments and payouts (Paystack) are not live yet, so the wallet shows job value from bookings:
// "earned" = completed bookings, "upcoming" = confirmed bookings not yet done.
const payoutsComingSoon = () =>
  alertService.alert('Payouts coming soon', 'Withdrawals to your bank account will be available once in-app payments launch.');

const isThisMonth = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

export default function Earnings() {
  const { user } = useUser();
  const supabase = useSupabase();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_my_bookings');
    if (error) alertService.alert('Error', errorMessage(error));
    else setBookings(((data ?? []) as BookingItem[]).filter((b) => b.role === 'provider'));
    setLoading(false);
    setRefreshing(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(user ? `provider-wallet:${user.id}` : null, [
    { table: 'bookings', filter: `provider_id=eq.${user?.id}` },
  ], load);

  const stats = useMemo(() => {
    const completed = bookings.filter((b) => b.status === 'completed');
    const upcoming = bookings.filter((b) => ['confirmed', 'en_route', 'in_progress'].includes(b.status));
    const sum = (list: BookingItem[]) => list.reduce((total, b) => total + b.agreed_amount, 0);
    const thisMonth = completed.filter((b) => isThisMonth(b.scheduled_at));
    return {
      earned: sum(completed),
      thisMonth: sum(thisMonth),
      thisMonthCount: thisMonth.length,
      upcoming: sum(upcoming),
      upcomingCount: upcoming.length,
      history: [...completed, ...upcoming].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)),
    };
  }, [bookings]);

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
      <ScrollView
        className="flex-1 px-4 pt-3"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text className="text-2xl font-bold text-gray-900 mt-2 mb-4">Wallet</Text>

        {/* Total earned */}
        <View className="bg-[#0B3356] rounded-[24px] p-5 mb-5">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-blue-200 text-xs font-medium">Total Earned</Text>
              <Text className="text-white text-[32px] font-bold tracking-tight mt-1">
                {balanceVisible ? formatNaira(stats.earned) : '₦••••••••'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setBalanceVisible(!balanceVisible)}
              className="w-9 h-9 rounded-full bg-white/10 items-center justify-center"
            >
              <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={18} color="white" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={payoutsComingSoon}
            className="bg-white/10 py-3 rounded-xl items-center flex-row justify-center"
          >
            <Ionicons name="time-outline" size={16} color="white" />
            <Text className="text-white font-bold text-sm ml-2">Withdrawals coming soon</Text>
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View className="flex-row justify-between mb-6">
          <View className="w-[48%] bg-white rounded-2xl p-4">
            <Text className="text-xs text-gray-500 font-medium">This Month</Text>
            <Text className="text-lg font-bold text-emerald-600 mt-1">{formatNaira(stats.thisMonth)}</Text>
            <Text className="text-[11px] text-gray-400 mt-0.5">
              {stats.thisMonthCount} completed job{stats.thisMonthCount === 1 ? '' : 's'}
            </Text>
          </View>
          <View className="w-[48%] bg-white rounded-2xl p-4">
            <Text className="text-xs text-gray-500 font-medium">Upcoming</Text>
            <Text className="text-lg font-bold text-amber-600 mt-1">{formatNaira(stats.upcoming)}</Text>
            <Text className="text-[11px] text-gray-400 mt-0.5">
              {stats.upcomingCount} booked job{stats.upcomingCount === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        <Text className="text-base font-bold text-gray-900 mb-3">Job History</Text>

        <View className="pb-10">
          {loading && <ActivityIndicator color="#2563EB" className="mt-6" />}
          {!loading && stats.history.length === 0 && (
            <View className="bg-white rounded-2xl p-8 items-center">
              <Ionicons name="wallet-outline" size={36} color="#9CA3AF" />
              <Text className="text-base font-bold text-gray-900 mt-3">No earnings yet</Text>
              <Text className="text-xs text-gray-500 text-center mt-1">Your booked and completed jobs will appear here.</Text>
            </View>
          )}
          {stats.history.map((b) => {
            const done = b.status === 'completed';
            return (
              <View key={b.id} className="bg-white rounded-2xl p-4 mb-3 flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 pr-3">
                  <View className={`w-11 h-11 rounded-xl items-center justify-center mr-3.5 ${done ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                    <Ionicons name={done ? 'checkmark-circle-outline' : 'calendar-outline'} size={20} color={done ? '#059669' : '#D97706'} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                      {serviceName(b.category)} • {b.customer_name}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {formatJobDate(b.scheduled_at)}, {formatJobTime(b.scheduled_at)}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className={`text-sm font-bold ${done ? 'text-emerald-600' : 'text-gray-900'}`}>{formatNaira(b.agreed_amount)}</Text>
                  <Text className="text-[10px] text-gray-400 mt-0.5">{done ? 'Completed' : 'Upcoming'}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
