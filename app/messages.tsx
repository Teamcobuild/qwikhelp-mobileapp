import { serviceName } from '@/constants/services';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { alertService } from '@/lib/AlertService';
import { errorMessage } from '@/lib/broadcast';
import { chatAvatar, ConversationListItem } from '@/lib/chat';
import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const when = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabase();
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_my_conversations');
    if (error) alertService.alert('Error', errorMessage(error));
    else setItems(data as ConversationListItem[]);
    setLoading(false);
    setRefreshing(false);
  }, [supabase]);

  // Refresh when coming back from a chat (read state changes).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useRealtimeRefresh(user ? `conversations:${user.id}` : null, [{ table: 'conversations' }], load);

  return (
    <SafeAreaView className="flex-1 bg-[#F9FAFB]">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="p-2 -ml-2 mr-2">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-gray-900">Messages</Text>
        <View className="w-10" />
      </View>

      {loading ? (
        <ActivityIndicator color="#2563EB" className="mt-10" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View className="items-center mt-16 px-8">
              <Ionicons name="chatbubbles-outline" size={40} color="#9CA3AF" />
              <Text className="text-base font-bold text-gray-900 mt-3">No conversations yet</Text>
              <Text className="text-sm text-gray-500 text-center mt-1">
                A chat opens as soon as you and the other person agree on a price.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/chat/[conversationId]', params: { conversationId: item.id } })}
              activeOpacity={0.7}
              className={`bg-white rounded-[20px] p-4 mb-3 flex-row items-center ${item.state === 'closed' ? 'opacity-60' : ''}`}
            >
              <Image source={{ uri: chatAvatar(item.counterpart) }} className="w-12 h-12 rounded-full mr-3 bg-gray-100" />
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[15px] font-bold text-gray-900 flex-1 pr-2" numberOfLines={1}>
                    {item.counterpart.name}
                  </Text>
                  <Text className="text-[11px] text-gray-400">{when(item.last_message_at)}</Text>
                </View>
                <Text className="text-[11px] text-blue-600 font-medium mt-0.5">
                  {serviceName(item.category)}
                  {item.state === 'closed' ? ' • Closed' : item.state === 'booked' ? ' • Booked' : ''}
                </Text>
                <View className="flex-row items-center justify-between mt-1">
                  <Text
                    className={`text-[13px] flex-1 pr-2 ${item.unread ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}
                    numberOfLines={1}
                  >
                    {item.last_message_preview || 'Say hello 👋'}
                  </Text>
                  {item.unread > 0 && (
                    <View className="bg-blue-600 min-w-[20px] h-5 rounded-full items-center justify-center px-1.5">
                      <Text className="text-white text-[10px] font-bold">{item.unread > 99 ? '99+' : item.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
