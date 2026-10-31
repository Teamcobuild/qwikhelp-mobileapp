import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNotifications } from "../context/NotificationContext";

const CATEGORIES = ["All", "Unread messages", "Read messages"];

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { icon: IconName; color: string; bg: string }> = {
    job_request: { icon: "briefcase", color: "#2563EB", bg: "bg-[#EFF6FF]" },
    offer_counter: { icon: "pricetag", color: "#D97706", bg: "bg-[#FFFBEB]" },
    offer_final_counter: { icon: "pricetag", color: "#D97706", bg: "bg-[#FFFBEB]" },
    offer_agreed: { icon: "thumbs-up", color: "#10B981", bg: "bg-[#ECFDF5]" },
    offer_declined: { icon: "close-circle", color: "#DC2626", bg: "bg-[#FEF2F2]" },
    offer_walked_away: { icon: "close-circle", color: "#DC2626", bg: "bg-[#FEF2F2]" },
    offer_withdrawn: { icon: "close-circle", color: "#DC2626", bg: "bg-[#FEF2F2]" },
    offer_not_selected: { icon: "people", color: "#6B7280", bg: "bg-gray-50" },
    offer_expired: { icon: "time", color: "#6B7280", bg: "bg-gray-50" },
    booking_confirmed: { icon: "receipt", color: "#10B981", bg: "bg-[#ECFDF5]" },
    booking_cancelled: { icon: "close-circle", color: "#DC2626", bg: "bg-[#FEF2F2]" },
    provider_on_the_way: { icon: "car", color: "#2563EB", bg: "bg-[#EFF6FF]" },
    service_started: { icon: "construct", color: "#2563EB", bg: "bg-[#EFF6FF]" },
    service_completed: { icon: "checkmark-circle", color: "#10B981", bg: "bg-[#ECFDF5]" },
    support_message: { icon: "chatbubble", color: "#1E3A8A", bg: "bg-[#EFF6FF]" },
};

const getNotificationIcon = (type: string) => ICONS[type] ?? { icon: "notifications" as IconName, color: "#6B7280", bg: "bg-gray-50" };

export default function NotificationsScreen() {
    const router = useRouter();
    const [selectedCategory, setSelectedCategory] = useState("All");
    const { notifications, unreadCount, markAllAsRead, open } = useNotifications();

    const filteredNotifications = notifications.filter((item) => {
        if (selectedCategory === "All") return true;
        if (selectedCategory === "Unread messages") return !item.isRead;
        if (selectedCategory === "Read messages") return item.isRead;
        return true;
    });

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pt-4 pb-6">
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-100"
                >
                    <Ionicons name="arrow-back" size={20} color="black" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-900">Notification</Text>
                <TouchableOpacity onPress={markAllAsRead} disabled={unreadCount === 0} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text className={`text-sm font-semibold ${unreadCount ? "text-[#2563EB]" : "text-gray-300"}`}>Mark all read</Text>
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View className="px-6 mb-6">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="flex-row"
                >
                    {CATEGORIES.map((cat, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => setSelectedCategory(cat)}
                            className={`mr-3 px-5 py-2 rounded-xl ${selectedCategory === cat
                                ? "bg-[#2563EB]"
                                : "bg-white"
                                }`}
                        >
                            <Text
                                className={`font-medium ${selectedCategory === cat
                                    ? "text-white"
                                    : "text-gray-400"
                                    }`}
                            >
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* List */}
            <ScrollView
                className="flex-1 px-4"
                showsVerticalScrollIndicator={false}
            >
                {filteredNotifications.length === 0 && (
                    <View className="items-center mt-16 px-8">
                        <Ionicons name="notifications-off-outline" size={40} color="#9CA3AF" />
                        <Text className="text-base font-bold text-gray-900 mt-3">No notifications</Text>
                        <Text className="text-sm text-gray-500 text-center mt-1">
                            Updates about your jobs, offers and bookings will show up here.
                        </Text>
                    </View>
                )}
                {filteredNotifications.map((item) => {
                    const iconConfig = getNotificationIcon(item.type);
                    return (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => open(item)}
                            activeOpacity={0.8}
                            className={`bg-white rounded-[20px] p-5 mb-4 border ${!item.isRead ? "border-blue-200 bg-blue-50/30" : "border-gray-100"
                                }`}
                        >
                            <View className="flex-row">
                                <View
                                    className={`w-12 h-12 rounded-full items-center justify-center mr-4 mt-1 ${iconConfig.bg}`}
                                >
                                    <Ionicons
                                        name={iconConfig.icon}
                                        size={22}
                                        color={iconConfig.color}
                                    />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row justify-between items-start mb-1">
                                        <Text className="text-base font-bold text-gray-900 pr-2 flex-1">
                                            {item.title}
                                        </Text>
                                        <Text className="text-xs text-gray-500 mt-1">
                                            {item.time}
                                        </Text>
                                    </View>
                                    <Text className="text-gray-500 text-[13px] leading-5">
                                        {item.description}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}
                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
