import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfferCard, Offer } from '../../../components/ui/OfferCard';

// Simulated Provider Data
const OFFERS_DATA = [
  {
    id: '1',
    name: 'Chinedu Okafor',
    rating: '4.2',
    image: 'https://i.pravatar.cc/150?img=11',
    description: 'Specializes in Nigeria & Continental meals',
    eta: 'Arriving in 4mins',
    distance: '2.3km away',
    type: 'accepted', // accepted | counter
  },
  {
    id: 'offer-456', // Specific ID to pass to bargain
    name: 'Ngozi Eze',
    rating: '4.2',
    image: 'https://i.pravatar.cc/150?img=5',
    description: 'Specializes in Nigeria & Continental meals',
    eta: 'Arriving in 2mins',
    distance: '2.3km away',
    type: 'counter',
  }
];

export default function OffersScreen() {
  const router = useRouter();
  const { jobId, category, duration, date, time, amount } = useLocalSearchParams<{
    jobId: string;
    category?: string;
    duration?: string;
    date?: string;
    time?: string;
    amount?: string;
  }>();

  const userBudget = amount ? parseInt(amount, 10) : 7000;
  const counterOfferAmount = userBudget + 1500; // Strictly more than user offer

  const OFFERS = OFFERS_DATA.map(offer => ({
    ...offer,
    amount: offer.type === 'counter' ? counterOfferAmount : null
  }));

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-6 py-4">
        <TouchableOpacity onPress={() => router.replace('/(customer-tabs)/home')} className="w-10 h-10 items-center justify-center -ml-2">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-gray-900 -ml-8">
          Offers For your Job
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Job Summary Card */}
        <View className="bg-white rounded-2xl p-4 mb-6 shadow-sm shadow-gray-100">
          <View className="flex-row items-center mb-3">
            <Text className="text-gray-400 font-medium mr-2">Service:</Text>
            <Text className="text-gray-900 font-bold capitalize">{category || 'Cooking'}</Text>
          </View>

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-600 font-medium">{duration || '4 Hours'}</Text>
            <Text className="text-gray-600 font-medium">{date || 'September 20, 2025'}</Text>
            <Text className="text-gray-600 font-medium">{time || '5:00 PM'}</Text>
          </View>

          <View className="flex-row items-center justify-between border-t border-gray-100 pt-4 mt-2">
            <View className="flex-row items-center">
              <Text className="text-gray-400 font-medium mr-2">Budget:</Text>
              <Text className="text-gray-900 font-bold text-lg">₦ {amount || '7000'}</Text>
            </View>
            <TouchableOpacity className="bg-blue-600 px-6 py-2 rounded-xl">
              <Text className="text-white font-bold">Edit Job</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Offers List */}
        <View className="pb-24">
          {OFFERS.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer as Offer}
              bookingDetails={{ category, duration, date, time, amount }}
            />
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
