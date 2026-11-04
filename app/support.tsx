import { SUPPORT_EMAIL } from "@/constants/legal";
import { alertService } from "@/lib/AlertService";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Support is by email for launch (no in-app agent console yet). The support_messages table and its
// realtime chat can come back once someone can answer from an admin tool.
export default function SupportScreen() {
    const router = useRouter();
    const { user } = useUser();

    const emailUs = () => {
        const subject = encodeURIComponent("QwikHelp support");
        // Account id helps us find their bookings without asking for personal details.
        const body = encodeURIComponent(`\n\n---\nAccount: ${user?.id ?? "unknown"}\nEmail: ${user?.primaryEmailAddress?.emailAddress ?? ""}`);
        Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(copyEmail);
    };

    const copyEmail = () => alertService.alert("Email us", `Send us an email at ${SUPPORT_EMAIL}`);

    return (
        <SafeAreaView className="flex-1 bg-[#F9FAFB]">
            <View className="flex-row items-center px-4 py-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="p-2 -ml-2 mr-2">
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-lg font-bold text-gray-900">Help & Support</Text>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1 px-5 pt-4">
                <View className="bg-white rounded-[20px] p-5 items-center mb-5">
                    <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-3">
                        <Ionicons name="mail" size={26} color="#2563EB" />
                    </View>
                    <Text className="text-base font-bold text-gray-900 mb-1">Email our team</Text>
                    <Text className="text-sm text-gray-500 text-center leading-5 mb-4">
                        Tell us what happened and include the booking date and service. We usually reply within one working day.
                    </Text>
                    <TouchableOpacity onPress={emailUs} className="bg-blue-600 rounded-xl py-3.5 w-full items-center mb-2">
                        <Text className="text-white font-bold">Email {SUPPORT_EMAIL}</Text>
                    </TouchableOpacity>
                    <Text selectable className="text-xs text-gray-500 py-2">{SUPPORT_EMAIL}</Text>
                </View>

                <Text className="text-xs font-bold text-gray-500 uppercase mb-2">Common questions</Text>
                <View className="bg-white rounded-[20px] px-4 py-2 mb-10">
                    {[
                        ["When does the provider get paid?", "We hold your payment and release it when you confirm the job is done, or 5 hours after the provider marks it done if you don't respond."],
                        ["How do I get a refund?", "Cancel the booking from Booking History before the provider checks in and you're refunded in full. Refunds can take a few working days to reach your bank."],
                        ["The provider asked me to pay outside the app", "Please don't. Payments outside QwikHelp aren't protected. Report the chat from its menu and email us."],
                    ].map(([q, a]) => (
                        <View key={q} className="py-3 border-b border-gray-100">
                            <Text className="text-sm font-bold text-gray-900 mb-1">{q}</Text>
                            <Text className="text-xs text-gray-500 leading-5">{a}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
