import React, { createContext, useContext, useState, useMemo } from 'react';

export type NotificationType = "booking_confirmed" | "provider_on_the_way" | "payment_successful" | "service_completed" | "system_update" | "support_message";

export interface NotificationItem {
    id: string;
    title: string;
    description: string;
    time: string;
    type: NotificationType;
    isRead: boolean;
    button?: string;
}

interface NotificationContextValue {
    notifications: NotificationItem[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const INITIAL_MOCK_NOTIFICATIONS: NotificationItem[] = [
    {
        id: "1",
        title: "Booking Confirmed",
        description: "Your booking for Egusi Soup with Joseph Prosper is confirmed for Sat, Sept 28 at 5:00 PM",
        time: "10m ago",
        type: "booking_confirmed",
        isRead: false,
    },
    {
        id: "2",
        title: "Provider on the way",
        description: "Your provider is on the way",
        time: "30m ago",
        type: "provider_on_the_way",
        isRead: false,
        button: "Live tracking",
    },
    {
        id: "3",
        title: "Payment Successful",
        description: "Your payment of $2700 was successful",
        time: "1 day ago",
        type: "payment_successful",
        isRead: true,
    },
    {
        id: "4",
        title: "Service Completed",
        description: "Service completed. Please rate your provider",
        time: "1hr ago",
        type: "service_completed",
        isRead: false,
        button: "Rate provider",
    },
    {
        id: "5",
        title: "System Update",
        description: "Update your app to enjoy faster booking",
        time: "1 day ago",
        type: "system_update",
        isRead: true,
    },
    {
        id: "6",
        title: "Support Message",
        description: "Need help? Our support team is available 24/7",
        time: "1 day ago",
        type: "support_message",
        isRead: true,
    },
];

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_MOCK_NOTIFICATIONS);

    const unreadCount = useMemo(() => {
        return notifications.filter(n => !n.isRead).length;
    }, [notifications]);

    const markAsRead = (id: string) => {
        setNotifications(prev => 
            prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
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
