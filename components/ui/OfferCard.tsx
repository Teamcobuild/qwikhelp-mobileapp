import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

export interface Offer {
  id: string;
  name: string;
  rating: string;
  image: string;
  description: string;
  eta: string;
  distance: string;
  type: string;
  amount?: string;
}

interface BookingDetails {
  category?: string;
  duration?: string;
  date?: string;
  time?: string;
  amount?: string;
}

interface OfferCardProps {
  offer: Offer;
  bookingDetails: BookingDetails;
}

export const OfferCard: React.FC<OfferCardProps> = ({ offer, bookingDetails }) => {
  const router = useRouter();
  const { category, duration, date, time, amount } = bookingDetails;

  return (
    <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm shadow-gray-100">
      {/* Provider Info */}
      <TouchableOpacity
        className="flex-row pb-4 items-center"
        onPress={() => router.push(`/provider-profile/${offer.id}`)}
      >
        <Image source={{ uri: offer.image }} className="w-12 h-12 rounded-full mr-3" />
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
        <View className="flex-row border border-gray-200 px-2 py-2 rounded-2xl items-center">
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
        <View className="flex-row border border-gray-200 px-2 py-2 rounded-2xl items-center">
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
  );
};
