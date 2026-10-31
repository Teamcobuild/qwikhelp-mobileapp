import type { SupabaseClient } from '@supabase/supabase-js';
import type { useRouter } from 'expo-router';
import { alertService } from './AlertService';
import { errorMessage } from './broadcast';

// 'open' = price agreed (text only), 'booked' = booking confirmed (text + photos), 'closed' = read-only.
export type ConversationState = 'open' | 'booked' | 'closed';

export interface Counterpart {
  id?: string;
  name: string;
  avatar_url: string | null;
}

export interface ConversationDetail {
  id: string;
  offer_id: string;
  job_id: string;
  role: 'customer' | 'provider';
  state: ConversationState;
  category: string;
  scheduled_at: string;
  other_last_read_at: string | null;
  counterpart: Counterpart;
}

export interface ConversationListItem {
  id: string;
  offer_id: string;
  job_id: string;
  category: string;
  state: ConversationState;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread: number;
  counterpart: Counterpart;
}

export interface ChatMessage {
  id: string;
  sender_id: string | null;
  kind: 'text' | 'image' | 'system';
  body: string | null;
  image_path: string | null;
  masked: boolean;
  created_at: string;
}

// In-app chat only: there is no way to reach the other person outside QwikHelp.
export const callsComingSoon = () =>
  alertService.alert('Coming Soon', 'In-app calls are coming soon. You can chat in the app in the meantime.');

// Opens the chat for an offer. The server decides whether chat is available yet (price agreed).
export async function openChat(supabase: SupabaseClient, router: ReturnType<typeof useRouter>, offerId: string | null | undefined) {
  if (!offerId) {
    alertService.alert('Chat not available yet', 'Chat opens once you agree on a price.');
    return;
  }
  const { data, error } = await supabase.rpc('open_chat', { p_offer: offerId });
  if (error) {
    alertService.alert('Chat not available yet', errorMessage(error));
    return;
  }
  router.push({ pathname: '/chat/[conversationId]', params: { conversationId: data as string } });
}

export const chatAvatar = (c: Counterpart) =>
  c.avatar_url || `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(c.name)}`;
