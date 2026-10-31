import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { serviceName } from "../../constants/services";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { BookingItem, formatJobDate, formatJobTime, JobSummary } from "../../lib/broadcast";
import { openChat } from "../../lib/chat";
import { useSupabase } from "../../lib/supabase";

const CATEGORIES = ["All", "Upcoming", "Completed", "Pending", "Canceled"];

interface HistoryItem {
    id: string;
    jobId: string;
    offerId?: string;
    providerName: string;
    serviceName: string;
    time: string;
    status: "Pending" | "Confirmed" | "Completed" | "Canceled";
    sortAt: string;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case "Pending":
            return {
                bg: "bg-[#FAEDE6]",
                text: "text-[#6E3F24]",
                iconBg: "bg-[#FAEDE6]",
                iconColor: "#6E3F24",
            };
        case "Confirmed":
            return {
                bg: "bg-[#E6F0FF]",
                text: "text-[#1A56DB]",
                iconBg: "bg-[#E6F0FF]",
                iconColor: "#1A56DB",
            };
        case "Canceled":
            return {
                bg: "bg-[#FEE2E2]",
                text: "text-[#7F1D1D]",
                iconBg: "bg-[#FEE2E2]",
                iconColor: "#7F1D1D",
            };
        case "Completed":
            return {
                bg: "bg-[#F3F4F6]",
                text: "text-[#4B5563]",
                iconBg: "bg-[#F3F4F6]",
                iconColor: "#4B5563",
            };
        default:
            return {
                bg: "bg-gray-100",
                text: "text-gray-800",
                iconBg: "bg-gray-100",
                iconColor: "#4B5563",
            };
    }
};

export default function HistoryScreen() {
    const router = useRouter();
    const { user } = useUser();
    const supabase = useSupabase();
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        if (!user) return;
        const [jobsRes, bookingsRes] = await Promise.all([
            supabase
                .from("jobs")
                .select("id, category, status, scheduled_at, created_at")
                .eq("customer_id", user.id)
                .neq("status", "booked")
                .order("created_at", { ascending: false })
                .limit(50),
            supabase.rpc("get_my_bookings"),
        ]);

        const when = (iso: string) => `${formatJobDate(iso)} ${formatJobTime(iso)}`;
        const jobs = ((jobsRes.data ?? []) as Pick<JobSummary, "id" | "category" | "status" | "scheduled_at" | "created_at">[])
            .map<HistoryItem>((j) => ({
                id: `job-${j.id}`,
                jobId: j.id,
                providerName: j.status === "open" ? "Finding providers…" : "No provider booked",
                serviceName: serviceName(j.category),
                time: j.status === "open" ? "Waiting…" : when(j.scheduled_at),
                status: j.status === "open" ? "Pending" : "Canceled",
                sortAt: j.created_at,
            }));
        const bookings = ((bookingsRes.data ?? []) as BookingItem[])
            .filter((b) => b.role === "customer")
            .map<HistoryItem>((b) => ({
                id: `bk-${b.id}`,
                jobId: b.job_id,
                offerId: b.offer_id,
                providerName: b.provider.name,
                serviceName: serviceName(b.category),
                time: when(b.scheduled_at),
                status: b.status === "completed" ? "Completed" : b.status === "cancelled" ? "Canceled" : "Confirmed",
                sortAt: b.scheduled_at,
            }));

        setItems([...jobs, ...bookings].sort((a, b) => b.sortAt.localeCompare(a.sortAt)));
        setLoading(false);
        setRefreshing(false);
    }, [supabase, user]);

    useEffect(() => {
        load();
    }, [load]);

    useRealtimeRefresh(user ? `customer-history:${user.id}` : null, [
        { table: "jobs", filter: `customer_id=eq.${user?.id}` },
        { table: "bookings", filter: `customer_id=eq.${user?.id}` },
    ], load);

    const filteredData = items.filter((item) => {
        if (selectedCategory === "All") return true;
        if (selectedCategory === "Upcoming") return item.status === "Confirmed";
        if (selectedCategory === "Completed") return item.status === "Completed";
        if (selectedCategory === "Pending") return item.status === "Pending";
        if (selectedCategory === "Canceled") return item.status === "Canceled";
        return true;
    });

    const isEmpty = filteredData.length === 0;

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={["top"]}>
            <View className="flex-row items-center px-4 pt-2 pb-6">
                <View className="w-10" />
                <Text className="flex-1 text-xl font-bold text-center text-gray-900">
                    Booking History
                </Text>
                <TouchableOpacity
                    onPress={() => router.push("/messages")}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="w-10 h-10 rounded-full bg-white items-center justify-center"
                >
                    <Ionicons name="chatbubbles-outline" size={20} color="#111827" />
                </TouchableOpacity>
            </View>

            <View className="pl-6 mb-6">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="flex-row"
                >
                    {CATEGORIES.map((cat, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => setSelectedCategory(cat)}
                            className={`mr-3 px-6 py-2.5 rounded-xl ${selectedCategory === cat ? "bg-[#2563EB]" : "bg-white"
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
                    <View className="w-6" />
                </ScrollView>
            </View>

            {loading ? (
                <ActivityIndicator color="#2563EB" className="mt-10" />
            ) : isEmpty ? (
                <View className="flex-1 items-center justify-center px-6 pb-20">
                    <Ionicons
                        name="search-outline"
                        size={80}
                        color="#3B82F6"
                        className="opacity-50"
                    />
                    <View className="flex-row mt-4 mb-2">
                        <Ionicons name="people" size={40} color="#1E3A8A" className="mr-2" />
                        <Ionicons name="document-text" size={40} color="#93C5FD" />
                    </View>
                    <Text className="text-[#374151] text-base font-medium mt-4">
                        Your booking history is empty!
                    </Text>
                </View>
            ) : (
                <ScrollView
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
                >
                    {filteredData.map((item) => {
                        const colors = getStatusColor(item.status);
                        return (
                            <TouchableOpacity
                                key={item.id}
                                activeOpacity={0.85}
                                onPress={() => router.push({ pathname: "/booking/offers/[jobId]", params: { jobId: item.jobId } })}
                                className="bg-white rounded-[24px] p-5 mb-4 border border-gray-100"
                            >
                                <View className="flex-row justify-between items-center mb-4">
                                    <Text className="text-base font-bold text-gray-900">
                                        {item.providerName}
                                    </Text>
                                    <View className={`px-4 py-1.5 rounded-full ${colors.bg}`}>
                                        <Text className={`text-sm font-medium ${colors.text}`}>
                                            {item.status}
                                        </Text>
                                    </View>
                                </View>

                                <View className="flex-row justify-between items-end">
                                    <View>
                                        <Text className="text-gray-800 font-bold mb-2">
                                            {item.serviceName}
                                        </Text>
                                        <Text className={`text-sm font-medium ${colors.text}`}>
                                            {item.time}
                                        </Text>
                                    </View>
                                    {item.offerId && (
                                        <TouchableOpacity
                                            onPress={() => openChat(supabase, router, item.offerId)}
                                            className={`w-12 h-12 rounded-full items-center justify-center ${colors.iconBg}`}
                                        >
                                            <Ionicons
                                                name="chatbubble-ellipses"
                                                size={20}
                                                color={colors.iconColor}
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    <View className="h-10" />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
