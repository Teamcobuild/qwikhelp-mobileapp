import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { serviceName } from "../../constants/services";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { alertService } from "../../lib/AlertService";
import { BookingItem, errorMessage, formatJobDate, formatJobTime, formatNaira, JobSummary } from "../../lib/broadcast";
import { openChat } from "../../lib/chat";
import { callPayments } from "../../lib/payments";
import { CancelReasonModal } from "../../components/modals/CancelReasonModal";
import { EmptyBookingsArt, EmptyState } from "../../components/illustrations/EmptyStates";
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
    booking?: BookingItem;
}

const timeLeft = (iso: string | null) => {
    const ms = iso ? new Date(iso).getTime() - Date.now() : 0;
    if (ms <= 0) return "shortly";
    const h = Math.floor(ms / 3600000);
    const m = Math.ceil((ms % 3600000) / 60000);
    return h ? `in ${h}h ${m}m` : `in ${m}m`;
};

// One line explaining where the money and the job stand.
const stageText = (b: BookingItem) => {
    const name = b.provider.name.split(" ")[0];
    switch (b.status) {
        case "pending_payment": return "Awaiting your payment";
        case "confirmed":
        case "en_route": return `Paid • ${formatNaira(b.agreed_amount)} held in escrow`;
        case "in_progress": return `${name} has arrived`;
        case "awaiting_confirmation": return `${name} marked it done • auto-confirms ${timeLeft(b.auto_release_at)}`;
        case "completed": return "Payment released to provider";
        case "cancelled":
            if (b.payment_status === "refunded") return `Cancelled • ${formatNaira(b.agreed_amount)} refunded`;
            if (b.payment_status === "refund_pending") return `Cancelled • refund of ${formatNaira(b.agreed_amount)} on its way`;
            if (b.payment_status === "refund_failed") return "Cancelled • refund delayed, please contact support";
            return b.cancelled_by === "provider" ? "Cancelled by provider" : "Cancelled";
        default: return null;
    }
};

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
    const [cancelling, setCancelling] = useState<BookingItem | null>(null);
    const [submitting, setSubmitting] = useState(false);

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
                status: b.status === "completed" ? "Completed" : b.status === "cancelled" ? "Canceled" : b.status === "pending_payment" ? "Pending" : "Confirmed",
                sortAt: b.scheduled_at,
                booking: b,
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

    const confirmDone = (b: BookingItem) => {
        alertService.alert("Is the job done?", `Confirming releases ${formatNaira(b.agreed_amount)} to ${b.provider.name.split(" ")[0]}. Only confirm if you are satisfied.`, [
            { text: "Not yet", style: "cancel" },
            {
                text: "Yes, release payment",
                onPress: async () => {
                    const { error } = await supabase.rpc("customer_confirm_done", { p_booking: b.id });
                    if (error) alertService.alert("Error", errorMessage(error));
                    else load();
                },
            },
        ]);
    };

    const cancelBooking = async (reason: string | null) => {
        if (!cancelling) return;
        setSubmitting(true);
        try {
            const res = await callPayments<{ refund: boolean }>(supabase, "cancel", { booking_id: cancelling.id, reason });
            const amount = formatNaira(cancelling.agreed_amount);
            setCancelling(null);
            alertService.alert("Booking cancelled", res.refund ? `Your ${amount} is being refunded in full. It can take a few days to show.` : "Your booking was cancelled.");
            load();
        } catch (err) {
            alertService.alert("Could not cancel", errorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={["top"]}>
            <View className="flex-row items-center px-4 pt-2 pb-6">
                <View className="w-10" />
                <Text className="flex-1 text-xl font-bold text-center text-gray-900">
                    Booking History
                </Text>
                <View className="w-10" />
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
                <View className="flex-1 justify-center pb-20">
                    <EmptyState
                        art={<EmptyBookingsArt />}
                        title={selectedCategory === "All" ? "No bookings yet" : `No ${selectedCategory.toLowerCase()} bookings`}
                        message="Book a service from Home and it will show up here."
                    />
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
                                onPress={() =>
                                    item.booking?.status === "pending_payment"
                                        ? router.push({ pathname: "/booking/pay/[bookingId]", params: { bookingId: item.booking.id } })
                                        : router.push({ pathname: "/booking/offers/[jobId]", params: { jobId: item.jobId } })
                                }
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

                                {item.booking && (
                                    <BookingStage
                                        booking={item.booking}
                                        onConfirm={confirmDone}
                                        onCancel={setCancelling}
                                        onPay={(b) => router.push({ pathname: "/booking/pay/[bookingId]", params: { bookingId: b.id } })}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                    <View className="h-10" />
                </ScrollView>
            )}

            <CancelReasonModal
                visible={!!cancelling}
                role="customer"
                submitting={submitting}
                refundNote={cancelling?.payment_status === "paid" ? `The provider hasn't arrived yet, so your ${formatNaira(cancelling.agreed_amount)} will be refunded in full.` : undefined}
                onClose={() => setCancelling(null)}
                onConfirm={cancelBooking}
            />
        </SafeAreaView>
    );
}

function BookingStage({ booking: b, onConfirm, onCancel, onPay }: {
    booking: BookingItem;
    onConfirm: (b: BookingItem) => void;
    onCancel: (b: BookingItem) => void;
    onPay: (b: BookingItem) => void;
}) {
    const text = stageText(b);
    const canCancel = b.status === "confirmed" || b.status === "en_route";
    return (
        <View className="border-t border-gray-100 mt-4 pt-3">
            {!!text && <Text className="text-xs text-gray-500 mb-2">{text}</Text>}
            {b.status === "pending_payment" && (
                <TouchableOpacity onPress={() => onPay(b)} className="bg-blue-600 rounded-xl py-2.5 items-center">
                    <Text className="text-white font-bold text-sm">Pay {formatNaira(b.agreed_amount)} into escrow</Text>
                </TouchableOpacity>
            )}
            {b.status === "awaiting_confirmation" && (
                <TouchableOpacity onPress={() => onConfirm(b)} className="bg-green-600 rounded-xl py-2.5 items-center">
                    <Text className="text-white font-bold text-sm">Confirm job done</Text>
                </TouchableOpacity>
            )}
            {canCancel && (
                <TouchableOpacity onPress={() => onCancel(b)} className="self-start py-1">
                    <Text className="text-red-600 font-semibold text-xs">Cancel booking (full refund)</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
