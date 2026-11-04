import { serviceName } from '@/constants/services';
import { useChatPresence } from '@/hooks/useChatPresence';
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
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import {
  Bubble,
  BubbleProps,
  Composer,
  ComposerProps,
  GiftedChat,
  IMessage,
  InputToolbar,
  InputToolbarProps,
  Send,
  SendProps,
  SystemMessage,
  SystemMessageProps,
} from 'react-native-gifted-chat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PAGE = 40;
const COLUMNS = 'id, sender_id, kind, body, image_path, masked, created_at';

const REPORT_REASONS = [
  'Asked to pay or talk outside QwikHelp',
  'Shared or asked for contact details',
  'Abusive or inappropriate',
];

type Status = 'sending' | 'failed' | 'sent' | 'read';

interface QMessage extends IMessage {
  status?: Status;
  masked?: boolean;
}

// Shown immediately on send, replaced by the stored row once the server accepts it.
interface PendingMessage {
  tempId: string;
  body: string | null;
  localImageUri: string | null;
  createdAt: Date;
  failed: boolean;
}

// Newest first, without duplicates.
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
  const insets = useSafeAreaInsets();

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [topHeight, setTopHeight] = useState(0);
  const focused = useRef(false);

  const { otherOnline, otherTyping, notifyTyping, stopTyping } = useChatPresence(conversationId, user?.id, !!detail);

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
      .subscribe((status) => {
        // Catch up on anything sent while the socket was down (app backgrounded, network drop).
        if (status === 'SUBSCRIBED') loadLatest();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, user?.id, markRead, loadDetail, loadLatest]);

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

  // Uploads (for photos) and stores one pending message; on failure it stays in the list marked failed.
  const deliver = async (p: PendingMessage) => {
    setPending((prev) => prev.map((x) => (x.tempId === p.tempId ? { ...x, failed: false } : x)));
    try {
      const imagePath = p.localImageUri ? await uploadImage(supabase, 'chat', conversationId, p.localImageUri) : null;
      const { data, error } = await supabase.rpc('send_message', {
        p_conversation: conversationId,
        p_body: imagePath ? null : p.body,
        p_image_path: imagePath,
      });
      if (error) throw error;
      setWarning(data?.warning ?? null);
      // Realtime usually delivers it first; fetch in case it didn't (body may have been masked).
      const { data: row } = await supabase.from('messages').select(COLUMNS).eq('id', data.id).maybeSingle();
      if (row) setMessages((prev) => merge(prev, [row as ChatMessage]));
      setPending((prev) => prev.filter((x) => x.tempId !== p.tempId));
    } catch (err) {
      setPending((prev) => prev.map((x) => (x.tempId === p.tempId ? { ...x, failed: true } : x)));
      alertService.alert(p.localImageUri ? 'Photo not sent' : 'Message not sent', errorMessage(err));
    }
  };

  const queue = (body: string | null, localImageUri: string | null) => {
    const p: PendingMessage = {
      tempId: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      body,
      localImageUri,
      createdAt: new Date(),
      failed: false,
    };
    setPending((prev) => [p, ...prev]);
    deliver(p);
  };

  const onSend = (sent: IMessage[]) => {
    const body = sent[0]?.text?.trim();
    if (!body) return;
    stopTyping();
    queue(body, null);
  };

  const sendPhoto = async () => {
    if (detail?.state !== 'booked') {
      alertService.alert('Photos', 'You can share photos once the booking is confirmed.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled) return;
    queue(null, result.assets[0].uri);
  };

  const onPressMessage = (_: unknown, message: IMessage) => {
    const p = pending.find((x) => x.tempId === message._id);
    if (!p?.failed) return;
    alertService.alert('Message not sent', undefined, [
      { text: 'Try again', onPress: () => deliver(p) },
      { text: 'Delete', style: 'destructive', onPress: () => setPending((prev) => prev.filter((x) => x.tempId !== p.tempId)) },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

  const state = detail?.state;
  const canSend = state === 'open' || state === 'booked';
  const me = useMemo(() => ({ _id: user?.id ?? 'me' }), [user?.id]);

  const giftedMessages = useMemo<QMessage[]>(() => {
    const readAt = detail?.other_last_read_at;
    const counterpart = detail ? { _id: 'other', name: detail.counterpart.name, avatar: chatAvatar(detail.counterpart) } : { _id: 'other' };

    const stored: QMessage[] = messages.map((m) => {
      const mine = m.sender_id === user?.id;
      const imageUrl = m.image_path ? imageUrls[m.image_path] : undefined;
      return {
        _id: m.id,
        text: m.kind === 'image' && !imageUrl ? 'Loading photo…' : m.body ?? '',
        createdAt: new Date(m.created_at),
        user: mine ? me : counterpart,
        image: imageUrl,
        system: m.kind === 'system',
        masked: m.masked,
        status: mine ? (readAt && m.created_at <= readAt ? 'read' : 'sent') : undefined,
      };
    });

    const local: QMessage[] = pending.map((p) => ({
      _id: p.tempId,
      text: p.body ?? '',
      createdAt: p.createdAt,
      user: me,
      image: p.localImageUri ?? undefined,
      status: p.failed ? 'failed' : 'sending',
    }));

    return [...local, ...stored];
  }, [messages, pending, imageUrls, detail, user?.id, me]);

  const renderTicks = (m: QMessage) => (
    <View className="flex-row items-center mr-2">
      {m.masked && <Ionicons name="eye-off-outline" size={11} color={m.user._id === me._id ? '#DBEAFE' : '#9CA3AF'} style={{ marginRight: 3 }} />}
      {m.status === 'sending' && <Ionicons name="time-outline" size={12} color="#DBEAFE" />}
      {m.status === 'failed' && <Ionicons name="alert-circle" size={13} color="#FCA5A5" />}
      {m.status === 'sent' && <Ionicons name="checkmark" size={13} color="#DBEAFE" />}
      {m.status === 'read' && <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />}
    </View>
  );

  const renderBubble = (props: BubbleProps<QMessage>) => (
    <Bubble
      {...props}
      wrapperStyle={{
        right: { backgroundColor: props.currentMessage.status === 'failed' ? '#93C5FD' : '#2563EB', borderRadius: 18, borderBottomRightRadius: 6 },
        left: { backgroundColor: '#FFFFFF', borderRadius: 18, borderBottomLeftRadius: 6 },
      }}
      textStyle={{
        right: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
        left: { color: '#111827', fontSize: 14, lineHeight: 20 },
      }}
      renderTicks={renderTicks}
    />
  );

  const renderSystemMessage = (props: SystemMessageProps<QMessage>) => (
    <SystemMessage
      {...props}
      containerStyle={{ marginVertical: 8, paddingHorizontal: 16 }}
      messageContainerStyle={{ backgroundColor: '#FFFBEB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 0 }}
      textStyle={{ color: '#92400E', fontSize: 12, textAlign: 'center', lineHeight: 16 }}
    />
  );

  const renderInputToolbar = (props: InputToolbarProps<QMessage>) =>
    canSend ? (
      <InputToolbar
        {...props}
        containerStyle={{ backgroundColor: '#FFFFFF', borderTopWidth: 0, paddingHorizontal: 8, paddingVertical: 6 }}
      />
    ) : detail ? (
      <View className="px-4 py-4 bg-white items-center">
        <Text className="text-xs text-gray-500">This chat is closed. You can still read past messages.</Text>
      </View>
    ) : null;

  const renderActions = () => (
    <TouchableOpacity onPress={sendPhoto} className="w-11 h-11 items-center justify-center self-end">
      <Ionicons name="image-outline" size={24} color={state === 'booked' ? '#4B5563' : '#D1D5DB'} />
    </TouchableOpacity>
  );

  const renderComposer = (props: ComposerProps) => (
    <Composer
      {...props}
      textInputProps={{
        ...props.textInputProps,
        placeholder: 'Message',
        placeholderTextColor: '#9CA3AF',
        maxLength: 2000,
        style: [
          props.textInputProps?.style,
          { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, color: '#111827', fontSize: 14 },
        ],
      }}
    />
  );

  const renderSend = (props: SendProps<QMessage>) => (
    <Send {...props} isSendButtonAlwaysVisible containerStyle={{ justifyContent: 'flex-end' }}>
      <View className={`ml-2 mb-0.5 w-10 h-10 rounded-full items-center justify-center ${props.text?.trim() ? 'bg-blue-600' : 'bg-gray-200'}`}>
        <Ionicons name="send" size={17} color="white" />
      </View>
    </Send>
  );

  const renderChatFooter = () =>
    warning ? (
      <TouchableOpacity onPress={() => setWarning(null)} className="flex-row items-start bg-amber-50 px-4 py-2.5">
        <Ionicons name="warning" size={16} color="#D97706" />
        <Text className="text-xs text-amber-800 ml-2 flex-1">{warning}</Text>
        <Ionicons name="close" size={16} color="#D97706" />
      </TouchableOpacity>
    ) : null;

  const subtitle = otherTyping
    ? 'typing…'
    : otherOnline
      ? 'Online'
      : detail
        ? `${serviceName(detail.category)} • ${formatJobDate(detail.scheduled_at)}, ${formatJobTime(detail.scheduled_at)}`
        : '';

  return (
    <View className="flex-1 bg-gray-50">
      <View onLayout={(e) => setTopHeight(e.nativeEvent.layout.height)} style={{ paddingTop: insets.top }} className="bg-white">
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
              <View className="mr-3">
                <Image source={{ uri: chatAvatar(detail.counterpart) }} className="w-10 h-10 rounded-full bg-gray-100" />
                {otherOnline && <View className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />}
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>{detail.counterpart.name}</Text>
                <Text className={`text-xs ${otherTyping || otherOnline ? 'text-green-600' : 'text-gray-500'}`} numberOfLines={1}>
                  {subtitle}
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
          <Text className="text-[10px] text-blue-800 ml-2 flex-1">
            Keep chats, calls and payments on QwikHelp. Payments made outside the app aren&apos;t protected.
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#2563EB" className="mt-10" />
      ) : (
        <GiftedChat<QMessage>
          messages={giftedMessages}
          onSend={onSend}
          user={me}
          isTyping={otherTyping}
          renderAvatar={null}
          renderBubble={renderBubble}
          renderSystemMessage={renderSystemMessage}
          renderInputToolbar={renderInputToolbar}
          renderActions={renderActions}
          renderComposer={renderComposer}
          renderSend={renderSend}
          renderChatFooter={renderChatFooter}
          onPressMessage={onPressMessage}
          textInputProps={{ onChangeText: notifyTyping }}
          loadEarlierMessagesProps={{
            isAvailable: hasOlder,
            isLoading: loadingOlder,
            onPress: loadOlder,
            isInfiniteScrollEnabled: true,
          }}
          dateFormatCalendar={{ sameDay: '[Today]', lastDay: '[Yesterday]', lastWeek: 'ddd, MMM D', sameElse: 'ddd, MMM D' }}
          timeFormat="h:mm A"
          isScrollToBottomEnabled
          keyboardAvoidingViewProps={{ keyboardVerticalOffset: topHeight }}
          messagesContainerStyle={{ backgroundColor: '#F9FAFB' }}
          listProps={{ keyboardShouldPersistTaps: 'handled' }}
        />
      )}
      <View style={{ height: insets.bottom }} className="bg-white" />
    </View>
  );
}
