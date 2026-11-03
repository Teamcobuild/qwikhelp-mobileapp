import { useSupabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

const TYPING_SEND_EVERY = 2000; // re-announce "typing" at most this often
const TYPING_IDLE_AFTER = 3000; // stop "typing" after this long without keystrokes
const TYPING_EXPIRE_AFTER = 5000; // hide the other side's indicator if we miss their "stopped" event

// Online status and typing indicator for one conversation, over Supabase Realtime presence + broadcast.
// Nothing is stored; both sides join the same `room:<conversationId>` topic.
export function useChatPresence(conversationId: string | undefined, userId: string | undefined, enabled: boolean) {
  const supabase = useSupabase();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const lastTypingSent = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !conversationId || !userId) return;

    const channel = supabase.channel(`room:${conversationId}`, {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const others = Object.keys(channel.presenceState()).filter((key) => key !== userId);
        setOtherOnline(others.length > 0);
        if (!others.length) setOtherTyping(false);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.userId === userId) return;
        if (expireTimer.current) clearTimeout(expireTimer.current);
        setOtherTyping(!!payload?.typing);
        if (payload?.typing) {
          expireTimer.current = setTimeout(() => setOtherTyping(false), TYPING_EXPIRE_AFTER);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() });
      });

    channelRef.current = channel;
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (expireTimer.current) clearTimeout(expireTimer.current);
      channelRef.current = null;
      setOtherOnline(false);
      setOtherTyping(false);
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, userId, enabled]);

  const sendTyping = useCallback(
    (typing: boolean) => {
      channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId, typing } });
    },
    [userId]
  );

  // Call on every keystroke; throttles "typing" and sends "stopped" once the user pauses.
  const notifyTyping = useCallback(
    (text: string) => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (!text.trim()) {
        if (lastTypingSent.current) sendTyping(false);
        lastTypingSent.current = 0;
        return;
      }
      const now = Date.now();
      if (now - lastTypingSent.current > TYPING_SEND_EVERY) {
        lastTypingSent.current = now;
        sendTyping(true);
      }
      idleTimer.current = setTimeout(() => {
        lastTypingSent.current = 0;
        sendTyping(false);
      }, TYPING_IDLE_AFTER);
    },
    [sendTyping]
  );

  // Call after sending so the other side's indicator clears immediately.
  const stopTyping = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (lastTypingSent.current) sendTyping(false);
    lastTypingSent.current = 0;
  }, [sendTyping]);

  return { otherOnline, otherTyping, notifyTyping, stopTyping };
}
