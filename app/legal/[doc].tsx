import { LEGAL_UPDATED, PRIVACY, TERMS } from '@/constants/legal';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// /legal/terms and /legal/privacy. Reachable before sign-in (sign-up links here).
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const router = useRouter();
  const content = doc === 'privacy' ? PRIVACY : TERMS;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-gray-900">{content.title}</Text>
        <View className="w-10" />
      </View>
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingVertical: 20, paddingBottom: 48 }}>
        <Text className="text-xs text-gray-400 mb-3">Last updated {LEGAL_UPDATED}</Text>
        <Text className="text-sm text-gray-700 leading-6 mb-5">{content.intro}</Text>
        {content.sections.map((s) => (
          <View key={s.heading} className="mb-5">
            <Text className="text-base font-bold text-gray-900 mb-2">{s.heading}</Text>
            {s.body.map((p, i) => (
              <Text key={i} className="text-sm text-gray-700 leading-6 mb-2">{p}</Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
