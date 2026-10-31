import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { registerForPush } from '@/lib/push';
import { useSupabase } from '@/lib/supabase';
import { useAuth, useUser } from '@clerk/clerk-expo';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Matches public.notifications.type (written by the database triggers).
export type NotificationType =
    | 'job_request'
    | 'offer_counter'
    | 'offer_final_counter'
    | 'offer_agreed'
    | 'offer_declined'
    | 'offer_walked_away'
    | 'offer_expired'
    | 'offer_withdrawn'
    | 'offer_not_selected'
    | 'booking_confirmed'
    | 'booking_cancelled'
    | 'provider_on_the_way'
    | 'service_started'
    | 'service_completed'
    | 'support_message'
    | (string & {});

export interface NotificationItem {
    id: string;
    title: string;
    description: string;
    time: string;
    type: NotificationType;
    isRead: boolean;
    url?: string;
}

interface NotificationRow {
    id: string;
    type: string;
    title: string;
    body: string;
    data: { url?: string } | null;
    read_at: string | null;
    created_at: string;
}

interface NotificationContextValue {
    notifications: NotificationItem[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    open: (item: NotificationItem) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const toItem = (r: NotificationRow): NotificationItem => ({
    id: r.id,
    title: r.title,
    description: r.body,
    time: timeAgo(r.created_at),
    type: r.type,
    isRead: !!r.read_at,
    url: r.data?.url,
});

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
    const { isSignedIn } = useAuth();
    const { user } = useUser();
    const supabase = useSupabase();
    const router = useRouter();
    const [rows, setRows] = useState<NotificationRow[]>([]);

    const load = useCallback(async () => {
        if (!isSignedIn) {
            setRows([]);
            return;
        }
        const { data, error } = await supabase
            .from('notifications')
            .select('id, type, title, body, data, read_at, created_at')
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) console.warn('Notifications fetch error:', error.message);
        else setRows(data as NotificationRow[]);
    }, [supabase, isSignedIn]);

    useEffect(() => {
        load();
    }, [load]);

    useRealtimeRefresh(isSignedIn && user ? `notifications:${user.id}` : null, [
        { table: 'notifications', filter: `user_id=eq.${user?.id}` },
    ], load);

    // Link this device to the signed-in user for push.
    useEffect(() => {
        if (!isSignedIn || !user) return;
        registerForPush(supabase).catch((err) => console.warn('Push registration failed:', err?.message ?? err));
    }, [isSignedIn, user?.id, supabase]);

    const markAsRead = useCallback(async (id: string) => {
        setRows((prev) => prev.map((r) => (r.id === id && !r.read_at ? { ...r, read_at: new Date().toISOString() } : r)));
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
    }, [supabase]);

    const markAllAsRead = useCallback(async () => {
        const now = new Date().toISOString();
        setRows((prev) => prev.map((r) => (r.read_at ? r : { ...r, read_at: now })));
        await supabase.from('notifications').update({ read_at: now }).is('read_at', null);
    }, [supabase]);

    const open = useCallback((item: NotificationItem) => {
        if (!item.isRead) markAsRead(item.id);
        if (item.url) router.push(item.url as any);
    }, [markAsRead, router]);

    // Tapping a push (including one that launched the app) opens its screen.
    const lastResponse = Notifications.useLastNotificationResponse();
    const handledResponse = useRef<string | null>(null);
    useEffect(() => {
        if (!isSignedIn || !user || !lastResponse) return;
        const id = lastResponse.notification.request.identifier;
        if (handledResponse.current === id) return;
        handledResponse.current = id;

        const data = lastResponse.notification.request.content.data as { url?: string; notificationId?: string };
        if (data?.notificationId) markAsRead(data.notificationId);
        // Let the root layout finish its role-based redirect first on a cold start.
        if (data?.url) setTimeout(() => router.push(data.url as any), 400);
    }, [lastResponse, isSignedIn, user, markAsRead, router]);

    const notifications = useMemo(() => rows.map(toItem), [rows]);
    const unreadCount = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);

    // Keep the app icon badge in step with unread notifications.
    useEffect(() => {
        Notifications.setBadgeCountAsync(unreadCount).catch(() => {});
    }, [unreadCount]);

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, open }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
