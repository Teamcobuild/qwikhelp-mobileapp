import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Simulated Provider Data
const PROVIDER_BASE = {
  id: 'offer-456',
  name: 'Ngozi Eze',
  rating: '4.2',
  image: 'https://i.pravatar.cc/150?img=5',
};


export default function BargainScreen() {
  const router = useRouter();
  const { offerId, category, duration, date, time, amount } = useLocalSearchParams<{
    offerId: string;
    category?: string;
    duration?: string;
    date?: string;
    time?: string;
    amount?: string;
  }>();

  const userBudget = amount ? parseInt(amount, 10) : 7000;
  const counterAmount = userBudget + 1500;
  const PROVIDER = { ...PROVIDER_BASE, offerAmount: counterAmount };

  // Generate smart chips based on the budget and counter
  const SUGGESTED_PRICES = [
    (userBudget + 500).toString(),
    (userBudget + 1000).toString(),
    counterAmount.toString(),
    (counterAmount + 500).toString(),
  ];

  const [price, setPrice] = useState(SUGGESTED_PRICES[0]);
  const [note, setNote] = useState('');
  const [messages, setMessages] = useState<{ sender: 'provider' | 'user', amount?: string, text: string }[]>([
    {
      sender: 'provider',
      text: 'I can only go for that amount considering the work involved'
    }
  ]);

  const handleSendOffer = () => {
    if (!price) return;
    setMessages(prev => [...prev, {
      sender: 'user',
      amount: price,
      text: note || 'Counter offer sent'
    }]);
    setNote('');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-6 py-4">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
            <Text className="flex-1 text-center text-lg font-bold text-gray-900 -ml-8">
              Bargain with {PROVIDER.name.split(' ')[0]}
            </Text>
          </View>
          <Text className="text-gray-400 text-center text-sm">
            Enter your best price to negotiate the service cost.
          </Text>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
          {/* Job Summary Card (Simplified) */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm shadow-gray-100">
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

          {/* Provider Card */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm shadow-gray-100">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <TouchableOpacity
                className="flex-row items-center"
                onPress={() => router.push(`/provider-profile/${PROVIDER.id}`)}
              >
                <Image source={{ uri: PROVIDER.image }} className="w-12 h-12 rounded-full mr-3" />
                <View>
                  <Text className="text-gray-900 font-bold text-base mb-1">{PROVIDER.name}</Text>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={14} color="#f97316" />
                    <Text className="text-orange-500 font-bold text-xs ml-1">{PROVIDER.rating}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <View className="flex-row gap-2">
                <TouchableOpacity className="w-8 h-8 rounded-full border border-gray-100 items-center justify-center">
                  <Ionicons name="call" size={14} color="#2563eb" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push(`/chat/${PROVIDER.id}`)}
                  className="w-8 h-8 rounded-full border border-gray-100 items-center justify-center bg-blue-50"
                >
                  <Ionicons name="chatbubble" size={14} color="#2563eb" />
                </TouchableOpacity>
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Text className="text-gray-900 font-medium mr-2">Offer:</Text>
                <Text className="text-gray-900 font-bold text-lg">₦{PROVIDER.offerAmount}</Text>
              </View>
              <TouchableOpacity className="bg-blue-600 px-8 py-2.5 rounded-xl">
                <Text className="text-white font-bold">Accept</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Chat / History Section */}
          <View className="mb-4">
            {messages.map((msg, index) => (
              <View key={index} className="bg-white rounded-2xl p-4 mb-3 shadow-sm shadow-gray-100">
                {msg.sender === 'provider' ? (
                  <View>
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center">
                        <Image source={{ uri: PROVIDER.image }} className="w-10 h-10 rounded-full mr-3" />
                        <View>
                          <Text className="text-gray-900 font-bold text-sm mb-0.5">{PROVIDER.name}</Text>
                          <View className="flex-row items-center">
                            <Ionicons name="star" size={12} color="#f97316" />
                            <Text className="text-orange-500 font-bold text-xs ml-1">{PROVIDER.rating}</Text>
                          </View>
                        </View>
                      </View>
                      <View className="flex-row gap-2">
                        <TouchableOpacity className="w-8 h-8 rounded-full border border-gray-100 items-center justify-center">
                          <Ionicons name="call" size={12} color="#2563eb" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => router.push(`/chat/${PROVIDER.id}`)}
                          className="w-8 h-8 rounded-full border border-gray-100 items-center justify-center bg-blue-50"
                        >
                          <Ionicons name="chatbubble" size={12} color="#2563eb" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <Text className="text-gray-600 text-sm">{msg.text}</Text>
                    </View>
                  </View>
                ) : (
                  <View>
                    <View className="flex-row items-center justify-end mb-2">
                      <Text className="text-gray-900 font-bold">You offered: ₦{msg.amount}</Text>
                    </View>
                    <View className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                      <Text className="text-blue-900 text-sm text-right">{msg.text}</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Input Section */}
          <View className="bg-white rounded-2xl p-4 mb-8 shadow-sm shadow-gray-100">
            {/* Amount Input */}
            <View className="relative justify-center mb-4">
              <Text className="absolute left-4 top-3.5 text-gray-900 text-base font-bold z-10">₦</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                className="border border-blue-200 rounded-xl pl-9 pr-4 py-3 bg-white text-gray-900 font-bold text-base"
              />
            </View>

            {/* Quick Chips */}
            <View className="flex-row flex-wrap gap-2 mb-6">
              {SUGGESTED_PRICES.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  onPress={() => setPrice(amt)}
                  className={`px-3 py-1.5 rounded-lg border ${price === amt ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200'}`}
                >
                  <Text className={`font-medium text-xs ${price === amt ? 'text-blue-700' : 'text-gray-500'}`}>
                    ₦{amt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Note Input */}
            <Text className="text-gray-900 font-medium mb-2 text-sm">Add Note (Optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Reason for your offer"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-900 text-sm mb-4"
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />

            <TouchableOpacity
              onPress={handleSendOffer}
              className="w-full bg-blue-600 py-3.5 rounded-xl items-center"
            >
              <Text className="text-white font-bold">Send Offer</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
