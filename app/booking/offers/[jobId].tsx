import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

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
      <View className="flex-row items-center px-6 py-4 bg-white border-b border-gray-100">
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
            <View key={offer.id} className="bg-white rounded-2xl p-4 mb-4 shadow-sm shadow-gray-100">
              
              {/* Provider Info */}
              <TouchableOpacity 
                className="flex-row"
                onPress={() => router.push(`/provider-profile/${offer.id}`)}
              >
                <Image source={{ uri: offer.image }} className="w-16 h-16 rounded-full mr-3" />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-gray-900 font-bold text-base">{offer.name}</Text>
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={14} color="#f97316" />
                      <Text className="text-orange-500 font-bold text-xs ml-1">{offer.rating}</Text>
                    </View>
                  </View>
                  <Text className="text-gray-500 text-xs mb-2" numberOfLines={2}>
                    {offer.description}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Tags & Actions */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <Ionicons name="time-outline" size={16} color="#9ca3af" className="mr-1" />
                  <Text className="text-gray-500 text-xs ml-1">{offer.eta}</Text>
                </View>
                {offer.type === 'accepted' ? (
                  <View className="bg-green-500 px-3 py-1 rounded-full">
                    <Text className="text-white font-bold text-xs">Offer Accepted!</Text>
                  </View>
                ) : (
                  <View className="bg-orange-500 px-3 py-1 rounded-full">
                    <Text className="text-white font-bold text-xs">Counter Offer: ₦{offer.amount}</Text>
                  </View>
                )}
              </View>

              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <Ionicons name="location-outline" size={16} color="#9ca3af" className="mr-1" />
                  <Text className="text-gray-500 text-xs ml-1">{offer.distance}</Text>
                </View>
                <View className="flex-row gap-3">
                  <TouchableOpacity className="w-8 h-8 rounded-full border border-gray-100 items-center justify-center">
                    <Ionicons name="call" size={14} color="#2563eb" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => router.push(`/chat/${offer.id}`)}
                    className="w-8 h-8 rounded-full border border-gray-100 items-center justify-center bg-blue-50"
                  >
                    <Ionicons name="chatbubble" size={14} color="#2563eb" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Main Action Button */}
              {offer.type === 'accepted' ? (
                <TouchableOpacity className="w-full bg-blue-600 py-3.5 rounded-xl items-center">
                  <Text className="text-white font-bold text-sm">Accept Offer & Book</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  onPress={() => router.push({
                    pathname: `/booking/bargain/${offer.id}`,
                    params: { category, duration, date, time, amount }
                  })}
                  className="w-full bg-blue-600 py-3.5 rounded-xl items-center"
                >
                  <Text className="text-white font-bold text-sm">Counter Offer</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
