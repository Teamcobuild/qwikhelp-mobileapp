import { clearPushToken } from "@/lib/push";
import { useSupabase } from "@/lib/supabase";
import { useAvatar } from "@/context/AvatarContext";
import { alertService } from "@/lib/AlertService";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
    const router = useRouter();
    const { user } = useUser();
    const { signOut } = useAuth();
    const supabase = useSupabase();
    const { avatarUrl } = useAvatar();

    const handleLogout = () => {
        alertService.alert("Logout", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                    await clearPushToken(supabase);
                    await signOut();
                    router.replace("/(auth)/sign-in");
                },
            },
        ]);
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F9FAFB]">
            <View className="flex-row items-center px-4 py-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="p-2 -ml-2 mr-2">
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-lg font-bold text-gray-900">Settings</Text>
                {/* Balances the back button so the title stays centred without covering it. */}
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
                {/* Account */}
                <TouchableOpacity
                    onPress={() => router.push("/edit-profile")}
                    activeOpacity={0.7}
                    className="bg-white rounded-[20px] p-4 mb-6 flex-row items-center"
                >
                    <View className="w-12 h-12 rounded-full bg-[#E0EDFF] items-center justify-center overflow-hidden mr-3">
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
                        ) : (
                            <Ionicons name="person" size={22} color="#2563EB" />
                        )}
                    </View>
                    <View className="flex-1">
                        <Text className="text-base font-bold text-gray-900" numberOfLines={1}>{user?.fullName || "Your profile"}</Text>
                        <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                            {user?.primaryEmailAddress?.emailAddress}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <Section title="Privacy & permissions">
                    <Row icon="location-outline" label="Location & saved address" onPress={() => router.push("/location")} />
                    <Row icon="notifications-outline" label="Notification permissions" onPress={() => Linking.openSettings()} />
                </Section>

                <Section title="Help">
                    <Row icon="chatbubble-ellipses-outline" label="Chat with support" onPress={() => router.push("/support")} />
                    <Row icon="sparkles-outline" label="Ask QwikHelp AI" onPress={() => router.push("/assistant")} />
                </Section>

                <Section title="About">
                    <View className="flex-row items-center px-4 py-3.5">
                        <Ionicons name="information-circle-outline" size={20} color="#374151" />
                        <Text className="flex-1 text-sm font-medium text-gray-900 ml-3">App version</Text>
                        <Text className="text-sm text-gray-500">{Constants.expoConfig?.version ?? "1.0.0"}</Text>
                    </View>
                </Section>

                <TouchableOpacity onPress={handleLogout} className="bg-white rounded-[20px] py-4 mb-10 flex-row items-center justify-center">
                    <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                    <Text className="text-red-600 font-bold text-sm ml-2">Log Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View className="mb-6">
            <Text className="text-xs font-bold text-gray-500 uppercase mb-2">{title}</Text>
            <View className="bg-white rounded-[20px] py-1">{children}</View>
        </View>
    );
}

function Row({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="flex-row items-center px-4 py-3.5">
            <Ionicons name={icon} size={20} color="#374151" />
            <Text className="flex-1 text-sm font-medium text-gray-900 ml-3">{label}</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </TouchableOpacity>
    );
}
