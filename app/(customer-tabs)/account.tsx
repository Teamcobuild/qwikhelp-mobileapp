import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { alertService } from "../../lib/AlertService";

export default function AccountScreen() {
    const { user } = useUser();
    const { signOut } = useAuth();
    const router = useRouter();

    const handleLogout = () => {
        alertService.alert("Logout", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                    await signOut();
                    router.dismissAll();
                    router.replace("/(auth)/sign-in");
                },
            },
        ]);
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F9FAFB]" edges={["top"]}>
            <ScrollView className="px-5 pt-8" showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <Image
                            source={{ uri: user?.imageUrl }}
                            className="w-[52px] h-[52px] rounded-full bg-gray-200"
                        />
                        <View className="ml-4">
                            <Text className="text-xl font-bold text-gray-900">
                                {user?.firstName || "Joseph"}
                            </Text>
                            <Text className="text-[13px] text-gray-500 mt-0.5">
                                {user?.emailAddresses[0]?.emailAddress ||
                                    "Josephjoseph23@gmail.com"}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        onPress={() => router.push("/(customer-tabs)/edit-profile")}
                        className="p-2 -mr-2"
                    >
                        <Ionicons name="create-outline" size={24} color="#2563EB" />
                    </TouchableOpacity>
                </View>

                {/* Settings Cards */}
                <SettingsCard
                    iconNode={<Ionicons name="chatbubble" size={26} color="#10B981" />}
                    title="Chat Support"
                    description="You can chat with our customer support here"
                    onPress={() => router.push("/(customer-tabs)/chat")}
                />
                <SettingsCard
                    iconNode={<Ionicons name="location" size={26} color="#F97316" />}
                    title="Location"
                    description="You can see and edit your location here"
                    onPress={() => router.push("/(customer-tabs)/location")}
                />
                <SettingsCard
                    iconNode={<Ionicons name="settings-sharp" size={26} color="#1F2937" />}
                    title="Settings"
                    description="You can chat with our customer support here"
                    onPress={() => router.push("/(customer-tabs)/settings")}
                />
                <SettingsCard
                    iconNode={
                        <View className="bg-[#2563EB] rounded-full w-7 h-7 items-center justify-center">
                            <Ionicons name="sparkles" size={14} color="white" />
                        </View>
                    }
                    title="QwikhelpAI"
                    description="Our Ai is here to assist you"
                    onPress={() => router.push("/(customer-tabs)/chat")}
                />

                {/* Logout Button */}
                <TouchableOpacity
                    onPress={handleLogout}
                    className="flex-row items-center mt-4 mb-10 py-2"
                >
                    <View className="w-8 mr-4 items-center">
                        <Ionicons
                            name="log-out-outline"
                            size={26}
                            color="#DC2626"
                            style={{ transform: [{ scaleX: -1 }] }}
                        />
                    </View>
                    <Text className="text-gray-900 text-[16px] font-bold">Logout</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

function SettingsCard({
    iconNode,
    title,
    description,
    onPress,
}: {
    iconNode: React.ReactNode;
    title: string;
    description: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className="bg-white rounded-[20px] p-[18px] mb-[14px] flex-row items-center border border-gray-50"
        >
            <View className="mr-[14px] justify-center items-center w-8">
                {iconNode}
            </View>
            <View className="flex-1">
                <Text className="text-[15px] font-bold text-gray-900 mb-0.5">{title}</Text>
                <Text className="text-[13px] text-gray-500">{description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#374151" />
        </TouchableOpacity>
    );
}
