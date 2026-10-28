import { alertService } from '@/lib/AlertService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Job {
  id: string;
  customerName: string;
  avatarSeed: string;
  avatarBg: string;
  service: string;
  address: string;
  status: 'In Progress' | 'Confirmed' | 'Completed' | 'Pending Quote';
  date: string;
  amount: string;
  phone: string;
}

const ALL_JOBS: Job[] = [
  {
    id: '1',
    customerName: 'Nwabueze Chukwumamkpam Nwabueze',
    avatarSeed: 'Nwabueze',
    avatarBg: '#B8E6CB',
    service: 'Deep House Cleaning',
    address: '70 Asa Road, Aba, Abia State',
    status: 'Confirmed',
    date: 'Today, 2:00 PM',
    amount: '₦25,000',
    phone: '+2348012345678',
  },
  {
    id: '2',
    customerName: 'Amaka Johnson',
    avatarSeed: 'Amaka',
    avatarBg: '#FED7AA',
    service: 'Electrical Inspection',
    address: '14 Okpara Avenue, Enugu',
    status: 'Pending Quote',
    date: 'Pending Quote',
    amount: '₦35,000',
    phone: '+2348087654321',
  },
  {
    id: '3',
    customerName: 'Tunde Balogun',
    avatarSeed: 'Tunde',
    avatarBg: '#DDD6FE',
    service: 'Plumbing Repair & Pipe Fitting',
    address: '28 Victoria Island, Lagos',
    status: 'In Progress',
    date: 'Started 1h ago',
    amount: '₦45,000',
    phone: '+2348099887766',
  },
  {
    id: '4',
    customerName: 'Chioma Adeyemi',
    avatarSeed: 'Chioma',
    avatarBg: '#BFDBFE',
    service: 'Air Conditioner Servicing',
    address: '12 Isaac Boro Way, Port Harcourt',
    status: 'Completed',
    date: 'Yesterday, 5:30 PM',
    amount: '₦20,000',
    phone: '+2348055443322',
  },
];

const JOB_FILTERS = ['All', 'Active', 'Pending', 'Completed'] as const;

export default function Jobs() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<typeof JOB_FILTERS[number]>('All');

  const filtered = ALL_JOBS.filter((job) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Active') return job.status === 'Confirmed' || job.status === 'In Progress';
    if (activeFilter === 'Pending') return job.status === 'Pending Quote';
    if (activeFilter === 'Completed') return job.status === 'Completed';
    return true;
  });

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'Confirmed':
      case 'In Progress':
        return { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]' };
      case 'Pending Quote':
        return { bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]' };
      case 'Completed':
        return { bg: 'bg-[#F3F4F6]', text: 'text-[#4B5563]' };
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-3" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between mt-2 mb-4">
          <Text className="text-2xl font-bold text-gray-900">My Jobs</Text>
          <View className="bg-blue-50 px-3 py-1 rounded-full">
            <Text className="text-blue-700 text-xs font-bold">{ALL_JOBS.length} Total</Text>
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
                  isActive ? 'bg-blue-600' : 'bg-white border border-gray-200'
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
          {filtered.map((job) => {
            const badge = getStatusBadge(job.status);
            return (
              <View
                key={job.id}
                style={styles.card}
                className="bg-white rounded-[22px] border border-gray-200 p-4 mb-4"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-center flex-1 pr-2">
                    <View
                      style={{ backgroundColor: job.avatarBg }}
                      className="w-12 h-12 rounded-xl items-center justify-center overflow-hidden mr-3"
                    >
                      <Image
                        source={{
                          uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${job.avatarSeed}&backgroundColor=${job.avatarBg.replace('#', '')}&facialHair=beardLight`,
                        }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                        {job.customerName}
                      </Text>
                      <Text className="text-xs text-gray-500 font-medium">{job.service}</Text>
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
                    onPress={() => router.push(`/chat/${job.id}` as any)}
                    className="flex-1 bg-blue-50 py-2.5 rounded-xl items-center flex-row justify-center"
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color="#2563EB" />
                    <Text className="text-blue-600 font-bold text-xs ml-1.5">Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${job.phone}`)}
                    className="flex-1 bg-gray-50 py-2.5 rounded-xl items-center flex-row justify-center border border-gray-200"
                  >
                    <Ionicons name="call-outline" size={15} color="#374151" />
                    <Text className="text-gray-700 font-bold text-xs ml-1.5">Call</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
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
