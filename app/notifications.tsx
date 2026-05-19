import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNotifications } from "../context/NotificationContext";

const CATEGORIES = ["All", "Unread messages", "Read messages"];

const getNotificationIcon = (type: string) => {
    switch (type) {
        case "booking_confirmed":
            return {
                icon: "receipt" as any,
                color: "#10B981", // emerald-500
                bg: "bg-[#ECFDF5]", // emerald-50
            };
        case "provider_on_the_way":
            return {
                icon: "car" as any,
                color: "#2563EB", // blue-600
                bg: "bg-[#EFF6FF]", // blue-50
            };
        case "payment_successful":
            return {
                icon: "logo-usd" as any,
                color: "#10B981", // emerald-500
                bg: "bg-[#ECFDF5]", // emerald-50
            };
        case "service_completed":
            return {
                icon: "checkmark-circle" as any,
                color: "#10B981", // emerald-500
                bg: "bg-[#ECFDF5]", // emerald-50
            };
        case "system_update":
            return {
                icon: "construct" as any,
                color: "#1E3A8A", // blue-900
                bg: "bg-[#EFF6FF]", // blue-50
            };
        case "support_message":
            return {
                icon: "chatbubble" as any,
                color: "#1E3A8A", // blue-900
                bg: "bg-[#EFF6FF]", // blue-50
            };
        default:
            return {
                icon: "notifications" as any,
                color: "#6B7280",
                bg: "bg-gray-50",
            };
    }
};

export default function NotificationsScreen() {
    const router = useRouter();
    const [selectedCategory, setSelectedCategory] = useState("All");
    const { notifications, markAsRead } = useNotifications();

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
                    className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-100"
                >
                    <Ionicons name="arrow-back" size={20} color="black" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-900">Notification</Text>
                <TouchableOpacity>
                    <Ionicons name="settings-outline" size={24} color="black" />
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
                {filteredNotifications.map((item) => {
                    const iconConfig = getNotificationIcon(item.type);
                    return (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => {
                                if (!item.isRead) markAsRead(item.id);
                            }}
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

                            {item.button && (
                                <TouchableOpacity className="mt-4 border border-[#2563EB] rounded-[14px] py-3 items-center">
                                    <Text className="text-[#2563EB] font-semibold text-sm">
                                        {item.button}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    );
                })}
                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
