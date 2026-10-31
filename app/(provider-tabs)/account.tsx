import { clearPushToken } from '@/lib/push';
import { useSupabase } from '@/lib/supabase';
import { useAvatar } from '@/context/AvatarContext';
import { alertService } from '@/lib/AlertService';
import { BookingItem } from '@/lib/broadcast';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProviderAccount() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const supabase = useSupabase();
  const router = useRouter();
  const { avatarUrl } = useAvatar();

  const handleLogout = () => {
    alertService.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearPushToken(supabase);
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  const [stats, setStats] = useState({ rating: 0, reviews: 0, jobsDone: 0 });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('provider_profiles').select('rating, review_count').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('get_my_bookings'),
    ]).then(([{ data: p }, { data: bookings }]) => {
      setStats({
        rating: Number(p?.rating ?? 0),
        reviews: p?.review_count ?? 0,
        jobsDone: ((bookings ?? []) as BookingItem[]).filter((b) => b.role === 'provider' && b.status === 'completed').length,
      });
    });
  }, [supabase, user]);

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-3" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text className="text-2xl font-bold text-gray-900 mt-2 mb-4">Profile</Text>

        {/* Profile Card */}
        <View
          className="bg-white rounded-[22px] p-5 mb-5"
        >
          <View className="flex-row items-center">
            <View className="w-16 h-16 rounded-full bg-[#E0EDFF] items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <Ionicons name="person" size={28} color="#2563EB" />
              )}
            </View>
            <View className="ml-4 flex-1">
              <View className="flex-row items-center">
                <Text className="text-lg font-bold text-gray-900 mr-2" numberOfLines={1}>
                  {user?.fullName || 'Your profile'}
                </Text>
                <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
              </View>
              <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                {user?.primaryEmailAddress?.emailAddress}
              </Text>
              <View className="flex-row items-center bg-emerald-50 px-2 py-0.5 rounded-md self-start mt-1.5">
                <Text className="text-[10px] font-bold text-emerald-700">Verified Provider</Text>
              </View>
            </View>
          </View>

          {/* Quick Stats */}
          <View className="flex-row justify-between pt-4 mt-4 border-t border-gray-100">
            <View className="items-center flex-1">
              <View className="flex-row items-center">
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text className="text-sm font-bold text-gray-900 ml-1">
                  {stats.reviews ? stats.rating.toFixed(1) : 'New'}
                </Text>
              </View>
              <Text className="text-[11px] text-gray-400 mt-0.5">Rating</Text>
            </View>

            <View className="w-px h-8 bg-gray-100 self-center" />

            <View className="items-center flex-1">
              <Text className="text-sm font-bold text-gray-900">{stats.jobsDone}</Text>
              <Text className="text-[11px] text-gray-400 mt-0.5">Jobs Done</Text>
            </View>

            <View className="w-px h-8 bg-gray-100 self-center" />

            <View className="items-center flex-1">
              <Text className="text-sm font-bold text-gray-900">{stats.reviews}</Text>
              <Text className="text-[11px] text-gray-400 mt-0.5">Reviews</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View
          className="bg-white rounded-[22px] p-2 mb-5"
        >
          <MenuItem
            icon="person-outline"
            title="Edit Profile"
            subtitle="Name and profile photo"
            onPress={() => router.push('/edit-profile')}
          />
          <MenuItem
            icon="document-text-outline"
            title="KYC & Verification Status"
            subtitle="National ID, Guarantor, Liveness"
            onPress={() => router.push('/verification-status')}
          />
          <MenuItem
            icon="wallet-outline"
            title="Wallet & Earnings"
            subtitle="Completed and upcoming jobs"
            onPress={() => router.push('/(provider-tabs)/earnings')}
          />
          <MenuItem
            icon="notifications-outline"
            title="Notifications"
            subtitle="Alerts and job broadcast preferences"
            onPress={() => router.push('/notifications')}
          />
        </View>

        {/* Support Section */}
        <View
          className="bg-white rounded-[22px] p-2 mb-6"
        >
          <MenuItem
            icon="help-circle-outline"
            title="Help & Provider Support"
            subtitle="Chat with the QwikHelp team"
            onPress={() => router.push('/support')}
          />
          <MenuItem
            icon="shield-outline"
            title="Terms of Service & Safety"
            subtitle="Provider code of conduct"
            onPress={() => alertService.alert('Terms', 'QwikHelp verified provider terms.')}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-white rounded-2xl p-4 flex-row items-center justify-center mb-10"
        >
          <Ionicons name="log-out-outline" size={20} color="#E11D48" />
          <Text className="text-rose-600 font-bold ml-2">Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center p-3 rounded-xl"
    >
      <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center mr-3">
        <Ionicons name={icon} size={19} color="#374151" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-gray-900">{title}</Text>
        <Text className="text-xs text-gray-400 mt-0.5">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </TouchableOpacity>
  );
}
