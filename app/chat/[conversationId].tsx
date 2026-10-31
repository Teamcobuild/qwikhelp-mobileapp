import { serviceName } from '@/constants/services';
import { alertService } from '@/lib/AlertService';
import { errorMessage, formatJobDate, formatJobTime, uploadImage } from '@/lib/broadcast';
import { callsComingSoon, chatAvatar, ChatMessage, ConversationDetail } from '@/lib/chat';
import { setActiveConversation } from '@/lib/push';
import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

const PAGE = 40;
const COLUMNS = 'id, sender_id, kind, body, image_path, masked, created_at';

const REPORT_REASONS = [
  'Asked to pay or talk outside QwikHelp',
  'Shared or asked for contact details',
  'Abusive or inappropriate',
];

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Newest first (the list is inverted), without duplicates.
const merge = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byId = new Map(current.map((m) => [m.id, m]));
  incoming.forEach((m) => byId.set(m.id, m));
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
};

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabase();

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [viewer, setViewer] = useState<string | null>(null);
  const focused = useRef(false);

  const loadDetail = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_conversation', { p_conversation: conversationId });
    if (error) {
      alertService.alert('Chat unavailable', errorMessage(error), [{ text: 'OK', onPress: () => router.back() }]);
      return;
    }
    setDetail(data as ConversationDetail);
  }, [supabase, conversationId, router]);

  const markRead = useCallback(() => {
    supabase.rpc('mark_conversation_read', { p_conversation: conversationId }).then(() => {});
  }, [supabase, conversationId]);

  const loadLatest = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select(COLUMNS)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(PAGE);
    if (error) alertService.alert('Error', errorMessage(error));
    else {
      setMessages((prev) => merge(prev, data as ChatMessage[]));
      if ((data?.length ?? 0) < PAGE) setHasOlder(false);
    }
    setLoading(false);
  }, [supabase, conversationId]);

  const loadOlder = async () => {
    if (loadingOlder || !hasOlder || !messages.length) return;
    setLoadingOlder(true);
    const oldest = messages[messages.length - 1].created_at;
    const { data } = await supabase
      .from('messages')
      .select(COLUMNS)
      .eq('conversation_id', conversationId)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(PAGE);
    setMessages((prev) => merge(prev, (data ?? []) as ChatMessage[]));
    if ((data?.length ?? 0) < PAGE) setHasOlder(false);
    setLoadingOlder(false);
  };

  useEffect(() => {
    loadDetail();
    loadLatest();
    markRead();
  }, [loadDetail, loadLatest, markRead]);

  // Live messages and read receipts.
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${conversationId}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => merge(prev, [m]));
          if (m.sender_id !== user?.id && focused.current) markRead();
          if (m.kind === 'system') loadDetail(); // booking confirmed / chat closed changes the state
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` },
        () => loadDetail()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, user?.id, markRead, loadDetail]);

  // Don't show push banners for this chat while it's on screen.
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setActiveConversation(conversationId);
      markRead();
      return () => {
        focused.current = false;
        setActiveConversation(null);
      };
    }, [conversationId, markRead])
  );

  // Signed URLs for photos (private bucket).
  useEffect(() => {
    const missing = messages.filter((m) => m.image_path && !imageUrls[m.image_path]).map((m) => m.image_path!);
    if (!missing.length) return;
    supabase.storage
      .from('chat')
      .createSignedUrls(missing, 60 * 60)
      .then(({ data }) => {
        const next: Record<string, string> = {};
        data?.forEach((d) => d.path && d.signedUrl && (next[d.path] = d.signedUrl));
        setImageUrls((prev) => ({ ...prev, ...next }));
      });
  }, [messages, imageUrls, supabase]);

  const send = async (imagePath?: string) => {
    const body = draft.trim();
    if ((!body && !imagePath) || sending) return;
    setSending(true);
    const { data, error } = await supabase.rpc('send_message', {
      p_conversation: conversationId,
      p_body: imagePath ? null : body,
      p_image_path: imagePath ?? null,
    });
    setSending(false);
    if (error) {
      alertService.alert('Message not sent', errorMessage(error));
      return;
    }
    if (!imagePath) setDraft('');
    setWarning(data?.warning ?? null);
    // Realtime usually delivers it first; fetch in case it didn't (body may have been masked).
    const { data: row } = await supabase.from('messages').select(COLUMNS).eq('id', data.id).maybeSingle();
    if (row) setMessages((prev) => merge(prev, [row as ChatMessage]));
  };

  const sendPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled) return;
    setSending(true);
    try {
      const path = await uploadImage(supabase, 'chat', conversationId, result.assets[0].uri);
      setSending(false);
      await send(path);
    } catch (err) {
      setSending(false);
      alertService.alert('Photo not sent', errorMessage(err));
    }
  };

  const openMenu = () => {
    if (!detail) return;
    alertService.alert('Chat options', undefined, [
      {
        text: 'View job',
        onPress: () =>
          detail.role === 'provider'
            ? router.push({ pathname: '/request/[jobId]', params: { jobId: detail.job_id } })
            : router.push({ pathname: '/booking/offers/[jobId]', params: { jobId: detail.job_id } }),
      },
      { text: 'Report this chat', style: 'destructive', onPress: report },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const report = () => {
    alertService.alert('Report this chat', 'What happened? Our team will review the conversation.', [
      ...REPORT_REASONS.map((reason) => ({
        text: reason,
        onPress: async () => {
          const { error } = await supabase.rpc('report_conversation', { p_conversation: conversationId, p_reason: reason });
          alertService.alert(error ? 'Error' : 'Thanks for telling us', error ? errorMessage(error) : 'We will look into it.');
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // The newest message of mine the other person has read.
  const seenId = useMemo(() => {
    const readAt = detail?.other_last_read_at;
    if (!readAt) return null;
    return messages.find((m) => m.sender_id === user?.id && m.created_at <= readAt)?.id ?? null;
  }, [messages, detail?.other_last_read_at, user?.id]);

  const state = detail?.state;
  const canSend = state === 'open' || state === 'booked';

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const older = messages[index + 1];
    const showDay = !older || dayLabel(older.created_at) !== dayLabel(item.created_at);
    const day = showDay && (
      <Text className="text-center text-[11px] font-medium text-gray-400 my-3">{dayLabel(item.created_at)}</Text>
    );

    if (item.kind === 'system') {
      return (
        <View>
          {day}
          <View className="self-center bg-amber-50 rounded-xl px-3 py-2 my-2 max-w-[90%]">
            <Text className="text-[12px] text-amber-800 text-center leading-4">{item.body}</Text>
          </View>
        </View>
      );
    }

    const mine = item.sender_id === user?.id;
    return (
      <View>
        {day}
        <View className={`mb-2 max-w-[80%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
          {item.kind === 'image' ? (
            <TouchableOpacity onPress={() => item.image_path && setViewer(imageUrls[item.image_path])} activeOpacity={0.9}>
              {item.image_path && imageUrls[item.image_path] ? (
                <Image source={{ uri: imageUrls[item.image_path] }} className="w-56 h-56 rounded-2xl bg-gray-200" />
              ) : (
                <View className="w-56 h-56 rounded-2xl bg-gray-200 items-center justify-center">
                  <ActivityIndicator color="#9CA3AF" />
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View className={`px-4 py-2.5 rounded-2xl ${mine ? 'bg-blue-600 rounded-br-md' : 'bg-white rounded-bl-md'}`}>
              <Text className={`text-sm leading-5 ${mine ? 'text-white' : 'text-gray-900'}`}>{item.body}</Text>
            </View>
          )}
          <View className="flex-row items-center mt-1">
            {item.masked && (
              <Ionicons name="eye-off-outline" size={11} color="#9CA3AF" style={{ marginRight: 3 }} />
            )}
            <Text className="text-[10px] text-gray-400">{timeLabel(item.created_at)}</Text>
            {mine && item.id === seenId && <Text className="text-[10px] text-blue-500 ml-1.5">Seen</Text>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 bg-white">
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="p-2 -ml-2 mr-1">
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          {detail ? (
            <TouchableOpacity
              className="flex-row items-center flex-1"
              disabled={detail.role !== 'customer' || !detail.counterpart.id}
              onPress={() => detail.counterpart.id && router.push(`/provider-profile/${detail.counterpart.id}`)}
            >
              <Image source={{ uri: chatAvatar(detail.counterpart) }} className="w-10 h-10 rounded-full mr-3 bg-gray-100" />
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>{detail.counterpart.name}</Text>
                <Text className="text-gray-500 text-xs" numberOfLines={1}>
                  {serviceName(detail.category)} • {formatJobDate(detail.scheduled_at)}, {formatJobTime(detail.scheduled_at)}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View className="flex-1" />
          )}
          <TouchableOpacity onPress={callsComingSoon} className="p-2">
            <Ionicons name="call-outline" size={22} color="#4b5563" />
          </TouchableOpacity>
          <TouchableOpacity onPress={openMenu} className="p-2 -mr-2">
            <Ionicons name="ellipsis-vertical" size={20} color="#4b5563" />
          </TouchableOpacity>
        </View>

        {/* Safety note */}
        <View className="flex-row items-center bg-blue-50 px-4 py-2">
          <Ionicons name="shield-checkmark" size={14} color="#2563EB" />
          <Text className="text-[11px] text-blue-800 ml-2 flex-1">
            Keep chats, calls and payments on QwikHelp. Payments made outside the app aren't protected.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#2563EB" className="mt-10" />
        ) : (
          <FlatList
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingOlder ? <ActivityIndicator color="#9CA3AF" className="my-3" /> : undefined}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {warning && (
          <TouchableOpacity onPress={() => setWarning(null)} className="flex-row items-start bg-amber-50 px-4 py-2.5">
            <Ionicons name="warning" size={16} color="#D97706" />
            <Text className="text-xs text-amber-800 ml-2 flex-1">{warning}</Text>
            <Ionicons name="close" size={16} color="#D97706" />
          </TouchableOpacity>
        )}

        {/* Composer */}
        {canSend ? (
          <View className="flex-row items-end px-4 py-3 bg-white">
            <TouchableOpacity
              onPress={() =>
                state === 'booked'
                  ? sendPhoto()
                  : alertService.alert('Photos', 'You can share photos once the booking is confirmed.')
              }
              className="w-11 h-11 items-center justify-center"
            >
              <Ionicons name="image-outline" size={24} color={state === 'booked' ? '#4B5563' : '#D1D5DB'} />
            </TouchableOpacity>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={2000}
              className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-gray-900 text-sm max-h-28"
            />
            <TouchableOpacity
              onPress={() => send()}
              disabled={!draft.trim() || sending}
              className={`ml-2 w-11 h-11 rounded-full items-center justify-center ${draft.trim() ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              {sending ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="send" size={18} color="white" />}
            </TouchableOpacity>
          </View>
        ) : (
          detail && (
            <View className="px-4 py-4 bg-white items-center">
              <Text className="text-xs text-gray-500">This chat is closed. You can still read past messages.</Text>
            </View>
          )
        )}
      </KeyboardAvoidingView>

      {/* Full-screen photo */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setViewer(null)} className="flex-1 bg-black items-center justify-center">
          {viewer && <Image source={{ uri: viewer }} className="w-full h-full" resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
