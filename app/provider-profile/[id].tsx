import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, ImageBackground, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PROVIDERS } from '../../constants/providers';

export default function ProviderProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const provider = PROVIDERS[id || '1'] || PROVIDERS['1'];

  const [activeTab, setActiveTab] = useState<'about' | 'reviews'>('about');
  const [showAddressModal, setShowAddressModal] = useState(false);

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} bounces={false}>
        {/* Cover Image & Header */}
        <ImageBackground
          source={{ uri: provider.coverImage }}
          className="w-full h-56"
        >
          <View className="absolute top-12 left-4 z-10">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-white/30 rounded-full items-center justify-center backdrop-blur-md"
            >
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
          </View>
        </ImageBackground>

        {/* Avatar & Basic Info */}
        <View className="-mt-12 px-4">
          <Image
            source={{ uri: provider.image }}
            className="w-24 h-24 rounded-full border-4 border-white"
          />

          <View className="flex-row items-center mt-2">
            <Text className="text-2xl font-bold text-gray-900">{provider.name}</Text>
            {provider.isPremium && (
              <View className="flex-row items-center bg-amber-100 px-2 py-1 rounded-md ml-2 border border-amber-200">
                <Ionicons name="shield-checkmark" size={12} color="#d97706" />
                <Text className="text-amber-600 text-[10px] font-bold ml-1 uppercase tracking-wider">Premium</Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center bg-green-100 self-start px-2.5 py-1 rounded-full mt-1.5">
            <Text className="text-green-700 text-xs font-bold mr-1">{provider.status}</Text>
            <View className="w-1.5 h-1.5 rounded-full bg-green-600" />
          </View>

          <Text className="text-gray-500 mt-4 text-[15px] leading-6">{provider.bio}</Text>

          <View className="flex-row items-center mt-3 pb-3">
            <Ionicons name="star" size={16} color="#f97316" />
            <Text className="text-orange-500 font-bold text-sm ml-1.5">
              {provider.rating} <Text className="text-gray-400 font-normal">({provider.reviewCount})</Text>
            </Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View className="flex-row items-center px-4 mt-6 gap-3">
          <TouchableOpacity
            onPress={() => router.push('/booking/cooking')}
            className="flex-1 bg-blue-600 py-3.5 rounded-xl items-center shadow-sm shadow-blue-200"
          >
            <Text className="text-white font-bold text-sm">Book Now</Text>
          </TouchableOpacity>

          <TouchableOpacity className="w-12 h-12 bg-orange-100 rounded-xl items-center justify-center">
            <Ionicons name="call-outline" size={20} color="#ea580c" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowAddressModal(true)}
            className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center"
          >
            <Ionicons name="location-outline" size={20} color="#16a34a" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push(`/chat/${provider.id}`)}
            className="w-12 h-12 bg-blue-100 rounded-xl items-center justify-center"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>

        {/* Tabs Toggle */}
        <View className="flex-row mx-4 mt-8 bg-gray-50 p-1 rounded-xl border border-gray-100">
          <TouchableOpacity
            onPress={() => setActiveTab('about')}
            className={`flex-1 py-3 items-center rounded-lg ${activeTab === 'about' ? 'bg-white shadow-sm shadow-gray-200' : ''}`}
          >
            <Text className={`font-bold ${activeTab === 'about' ? 'text-gray-900' : 'text-gray-400'}`}>About Us</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('reviews')}
            className={`flex-1 py-3 items-center rounded-lg ${activeTab === 'reviews' ? 'bg-white shadow-sm shadow-gray-200' : ''}`}
          >
            <Text className={`font-bold ${activeTab === 'reviews' ? 'text-gray-900' : 'text-gray-400'}`}>Reviews</Text>
          </TouchableOpacity>
        </View>

        {/* Content Section */}
        {activeTab === 'about' ? (
          <View className="pb-12">
            <Text className="text-lg font-bold text-gray-900 mx-4 mt-8 mb-4">Specialization</Text>
            <View className="flex-row flex-wrap px-4 gap-2 mb-6">
              {provider.specializations.map((spec: string, idx: number) => (
                <View key={idx} className="bg-blue-50 px-3.5 py-2 rounded-full">
                  <Text className="text-blue-600 text-[13px] font-medium">{spec}</Text>
                </View>
              ))}
            </View>

            <Text className="text-lg font-bold text-gray-900 mx-4 mt-2 mb-3">Description</Text>
            <Text className="text-gray-500 mx-4 leading-6 text-[15px]">{provider.description}</Text>
          </View>
        ) : (
          <View className="pb-12 pt-6">
            <Text className="text-center font-bold text-gray-900 text-lg">Would you recommend him?</Text>
            <View className="flex-row justify-center gap-3 mt-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons key={star} name="star" size={32} color="#d1d5db" />
              ))}
            </View>
            <View className="mx-4 mt-8 border border-gray-200 rounded-2xl bg-white p-4">
              <TextInput
                placeholder="Write your review..."
                placeholderTextColor="#9ca3af"
                multiline
                className="h-28 text-gray-900 text-base"
                textAlignVertical="top"
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Address Modal */}
      <Modal visible={showAddressModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white w-full rounded-3xl p-6 items-center shadow-lg">
            <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="location" size={32} color="#16a34a" />
            </View>
            <Text className="text-xl font-bold text-gray-900 mb-2">Location Address</Text>
            <Text className="text-gray-500 text-center text-base leading-6 mb-6">
              {provider.address}
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddressModal(false)}
              className="w-full bg-blue-600 py-3.5 rounded-xl items-center"
            >
              <Text className="text-white font-bold text-base">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}
