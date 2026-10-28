import { alertService } from '@/lib/AlertService';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProviderAccount() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    alertService.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  const firstName = user?.firstName || 'Emeka';

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-3" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text className="text-2xl font-bold text-gray-900 mt-2 mb-4">Profile</Text>

        {/* Profile Card */}
        <View
          style={styles.card}
          className="bg-white rounded-[22px] border border-gray-200 p-5 mb-5"
        >
          <View className="flex-row items-center">
            <View className="w-16 h-16 rounded-full bg-[#E0EDFF] items-center justify-center overflow-hidden border-2 border-blue-100">
              <Image
                source={{
                  uri:
                    user?.imageUrl ||
                    `https://api.dicebear.com/7.x/avataaars/png?seed=${firstName}&backgroundColor=dcebfe`,
                }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
            <View className="ml-4 flex-1">
              <View className="flex-row items-center">
                <Text className="text-lg font-bold text-gray-900 mr-2" numberOfLines={1}>
                  {user?.fullName || `${firstName} Okonkwo`}
                </Text>
                <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
              </View>
              <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                {user?.primaryEmailAddress?.emailAddress || 'provider@qwikhelp.com'}
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
                <Text className="text-sm font-bold text-gray-900 ml-1">4.9</Text>
              </View>
              <Text className="text-[11px] text-gray-400 mt-0.5">Rating</Text>
            </View>

            <View className="w-px h-8 bg-gray-100 self-center" />

            <View className="items-center flex-1">
              <Text className="text-sm font-bold text-gray-900">48</Text>
              <Text className="text-[11px] text-gray-400 mt-0.5">Jobs Done</Text>
            </View>

            <View className="w-px h-8 bg-gray-100 self-center" />

            <View className="items-center flex-1">
              <Text className="text-sm font-bold text-emerald-600">99%</Text>
              <Text className="text-[11px] text-gray-400 mt-0.5">Completion</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View
          style={styles.card}
          className="bg-white rounded-[22px] border border-gray-200 p-2 mb-5"
        >
          <MenuItem
            icon="person-outline"
            title="Edit Profile & Services"
            subtitle="Trade category, experience, bio"
            onPress={() => alertService.alert('Edit Profile', 'Profile editing is coming up next.')}
          />
          <MenuItem
            icon="document-text-outline"
            title="KYC & Verification Status"
            subtitle="National ID, Guarantor, Liveness"
            onPress={() => router.push('/verification-status')}
          />
          <MenuItem
            icon="wallet-outline"
            title="Bank & Payout Details"
            subtitle="Manage your settlement accounts"
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
          style={styles.card}
          className="bg-white rounded-[22px] border border-gray-200 p-2 mb-6"
        >
          <MenuItem
            icon="help-circle-outline"
            title="Help & Provider Support"
            subtitle="FAQs and contact QwikHelp"
            onPress={() => alertService.alert('Support', 'Contact support at support@qwikhelp.ng')}
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
          style={styles.card}
          className="bg-white rounded-2xl border border-rose-100 p-4 flex-row items-center justify-center mb-10"
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
      <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center mr-3 border border-gray-100">
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

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
});
