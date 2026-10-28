import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { tradeName } from '../../constants/kyc';
import { SERVICES } from '../../constants/services';
import { alertService } from '../../lib/AlertService';
import { errorMessage, ProviderCard } from '../../lib/broadcast';
import { useSupabase } from '../../lib/supabase';

interface ProviderProfile extends ProviderCard {
  trade_subtitle: string | null;
  city: string | null;
  is_online: boolean;
  portfolio_paths: string[];
  portfolio_titles: string[];
  completed_jobs: number;
}

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1000&auto=format&fit=crop';

export default function ProviderProfileScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'reviews'>('about');

  useEffect(() => {
    if (!id) return;
    supabase.rpc('get_provider_profile', { p_provider: id }).then(({ data, error }) => {
      if (error) setLoadError(errorMessage(error));
      else setProvider(data as ProviderProfile);
    });
  }, [supabase, id]);

  if (!provider) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        {loadError ? (
          <>
            <Text className="text-gray-900 font-bold text-lg mb-2">Profile unavailable</Text>
            <Text className="text-gray-500 text-center mb-6">{loadError}</Text>
            <TouchableOpacity onPress={() => router.back()} className="bg-blue-600 px-8 py-3 rounded-xl">
              <Text className="text-white font-bold">Go Back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator size="large" color="#2563EB" />
        )}
      </View>
    );
  }

  const portfolio = provider.portfolio_paths.map(
    (path) => supabase.storage.from('portfolio').getPublicUrl(path).data.publicUrl
  );
  const service = SERVICES.find((s) => s.id === provider.trade);
  const comingSoon = () =>
    alertService.alert('Coming Soon', 'In-app chat and calls with providers are coming in the next update.');

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} bounces={false}>
        {/* Cover Image & Header */}
        <ImageBackground
          source={{ uri: portfolio[0] || DEFAULT_COVER }}
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
            source={{ uri: provider.avatar_url || `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(provider.name)}` }}
            className="w-24 h-24 rounded-full border-4 border-white bg-gray-100"
          />

          <View className="flex-row items-center mt-2">
            <Text className="text-2xl font-bold text-gray-900">{provider.name}</Text>
            {provider.verified && (
              <View className="flex-row items-center bg-emerald-50 px-2 py-1 rounded-md ml-2 border border-emerald-200">
                <Ionicons name="shield-checkmark" size={12} color="#059669" />
                <Text className="text-emerald-700 text-[10px] font-bold ml-1 uppercase tracking-wider">KYC Verified</Text>
              </View>
            )}
          </View>

          <View className={`flex-row items-center self-start px-2.5 py-1 rounded-full mt-1.5 ${provider.is_online ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Text className={`text-xs font-bold mr-1 ${provider.is_online ? 'text-green-700' : 'text-gray-600'}`}>
              {provider.is_online ? 'Available' : 'Offline'}
            </Text>
            <View className={`w-1.5 h-1.5 rounded-full ${provider.is_online ? 'bg-green-600' : 'bg-gray-500'}`} />
          </View>

          {!!provider.bio && <Text className="text-gray-500 mt-4 text-[15px] leading-6">{provider.bio}</Text>}

          <View className="flex-row items-center mt-3 pb-3">
            <Ionicons name="star" size={16} color="#f97316" />
            <Text className="text-orange-500 font-bold text-sm ml-1.5">
              {provider.review_count ? Number(provider.rating).toFixed(1) : 'New'}{' '}
              <Text className="text-gray-400 font-normal">({provider.review_count} reviews • {provider.completed_jobs} jobs)</Text>
            </Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View className="flex-row items-center px-4 mt-6 gap-3">
          <TouchableOpacity
            onPress={() => router.push(`/booking/${service?.slug ?? 'cooking'}`)}
            className="flex-1 bg-blue-600 py-3.5 rounded-xl items-center shadow-sm shadow-blue-200"
          >
            <Text className="text-white font-bold text-sm">Request {service?.name ?? 'Service'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={comingSoon} className="w-12 h-12 bg-orange-100 rounded-xl items-center justify-center">
            <Ionicons name="call-outline" size={20} color="#ea580c" />
          </TouchableOpacity>

          <TouchableOpacity onPress={comingSoon} className="w-12 h-12 bg-blue-100 rounded-xl items-center justify-center">
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>

        {/* Tabs Toggle */}
        <View className="flex-row mx-4 mt-8 bg-gray-50 p-1 rounded-xl border border-gray-100">
          <TouchableOpacity
            onPress={() => setActiveTab('about')}
            className={`flex-1 py-3 items-center rounded-lg ${activeTab === 'about' ? 'bg-white shadow-sm shadow-gray-200' : ''}`}
          >
            <Text className={`font-bold ${activeTab === 'about' ? 'text-gray-900' : 'text-gray-400'}`}>About</Text>
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
              {[tradeName(provider.trade ?? undefined), provider.trade_subtitle, provider.years_experience]
                .filter(Boolean)
                .map((spec, idx) => (
                  <View key={idx} className="bg-blue-50 px-3.5 py-2 rounded-full">
                    <Text className="text-blue-600 text-[13px] font-medium">{spec}</Text>
                  </View>
                ))}
            </View>

            {portfolio.length > 0 && (
              <>
                <Text className="text-lg font-bold text-gray-900 mx-4 mt-2 mb-3">Past Work</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  {portfolio.map((uri, idx) => (
                    <View key={uri} className="mr-3 w-40">
                      <Image source={{ uri }} className="w-40 h-32 rounded-xl bg-gray-100" />
                      <Text className="text-xs text-gray-500 mt-1.5" numberOfLines={1}>
                        {provider.portfolio_titles[idx] || `Project #${idx + 1}`}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {!!provider.city && (
              <View className="flex-row items-center mx-4 mt-6">
                <Ionicons name="location-outline" size={16} color="#16a34a" />
                <Text className="text-gray-500 ml-1.5 text-[15px]">Based in {provider.city}</Text>
              </View>
            )}
          </View>
        ) : (
          <View className="pb-12 pt-6">
            <Text className="text-center font-bold text-gray-900 text-lg">Would you recommend them?</Text>
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
    </KeyboardAvoidingView>
  );
}
