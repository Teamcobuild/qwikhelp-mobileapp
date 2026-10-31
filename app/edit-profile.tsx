import { useAvatar } from "@/context/AvatarContext";
import { alertService } from "@/lib/AlertService";
import { useSupabase } from "@/lib/supabase";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", webp: "image/webp" };

export default function EditProfileScreen() {
    const { user } = useUser();
    const router = useRouter();
    const supabase = useSupabase();
    const { avatarUrl, reload: reloadAvatar } = useAvatar();

    const [firstName, setFirstName] = useState(user?.firstName || "");
    const [lastName, setLastName] = useState(user?.lastName || "");
    const [pickedUri, setPickedUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.6,
            });
            if (!result.canceled) setPickedUri(result.assets[0].uri);
        } catch {
            alertService.alert("Error", "Failed to pick image");
        }
    };

    // Public avatars bucket, {userId}/... (see storage policies in the foundation migration).
    const uploadAvatar = async (uri: string) => {
        const res = await fetch(uri);
        const body = await res.arrayBuffer();
        const ext = (uri.split("?")[0].split(".").pop() || "").toLowerCase();
        const contentType = MIME_BY_EXT[ext] || res.headers.get("content-type") || "image/jpeg";
        const fileExt = Object.entries(MIME_BY_EXT).find(([, mime]) => mime === contentType)?.[0] || "jpg";
        const path = `${user!.id}/avatar-${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from("avatars").upload(path, body, { contentType });
        if (error) throw error;
        return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    };

    const handleSave = async () => {
        if (!user) return;
        if (!firstName.trim() || !lastName.trim()) {
            alertService.alert("Error", "First and Last name are required.");
            return;
        }

        setLoading(true);
        try {
            const newAvatarUrl = pickedUri ? await uploadAvatar(pickedUri) : undefined;
            const fullName = `${firstName.trim()} ${lastName.trim()}`;

            const { error } = await supabase
                .from("profiles")
                .update({ full_name: fullName, ...(newAvatarUrl && { avatar_url: newAvatarUrl }) })
                .eq("id", user.id);
            if (error) throw error;

            await user.update({ firstName: firstName.trim(), lastName: lastName.trim() });
            await reloadAvatar();

            alertService.alert("Success", "Profile updated successfully!", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (error: any) {
            alertService.alert("Error", error.errors?.[0]?.longMessage || error.message || "Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    const shownImage = pickedUri || avatarUrl;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-row items-center px-4 py-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="p-2 -ml-2 mr-2">
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-lg font-bold text-gray-900">Edit Profile</Text>
                {/* Balances the back button so the title stays centred without covering it. */}
                <View className="w-10" />
            </View>

            <KeyboardAwareScrollView bottomOffset={24} className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
                <View className="items-center mb-8">
                    <TouchableOpacity onPress={pickImage} activeOpacity={0.8} className="relative">
                        <View className="w-28 h-28 rounded-full bg-[#E0EDFF] items-center justify-center overflow-hidden">
                            {shownImage ? (
                                <Image source={{ uri: shownImage }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <Ionicons name="person" size={48} color="#2563EB" />
                            )}
                        </View>
                        <View className="absolute bottom-0 right-0 bg-blue-600 w-9 h-9 rounded-full items-center justify-center border-2 border-white">
                            <Ionicons name="camera" size={18} color="white" />
                        </View>
                    </TouchableOpacity>
                    <Text className="text-xs text-gray-500 mt-3">Tap to change your photo</Text>
                </View>

                <View className="mb-5">
                    <Text className="text-gray-700 font-medium mb-2 text-[15px]">First Name</Text>
                    <TextInput
                        value={firstName}
                        onChangeText={setFirstName}
                        className="w-full bg-gray-50 rounded-xl px-4 py-3.5 text-gray-900 text-base"
                        placeholder="Enter your first name"
                        placeholderTextColor="#9CA3AF"
                    />
                </View>

                <View className="mb-5">
                    <Text className="text-gray-700 font-medium mb-2 text-[15px]">Last Name</Text>
                    <TextInput
                        value={lastName}
                        onChangeText={setLastName}
                        className="w-full bg-gray-50 rounded-xl px-4 py-3.5 text-gray-900 text-base"
                        placeholder="Enter your last name"
                        placeholderTextColor="#9CA3AF"
                    />
                </View>

                <View className="mb-8">
                    <Text className="text-gray-700 font-medium mb-2 text-[15px]">Email</Text>
                    <View className="w-full bg-gray-50 rounded-xl px-4 py-3.5">
                        <Text className="text-gray-500 text-base">{user?.primaryEmailAddress?.emailAddress}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleSave}
                    disabled={loading}
                    className="w-full bg-blue-600 py-4 rounded-xl items-center mb-10 flex-row justify-center"
                >
                    {loading ? <ActivityIndicator color="white" className="mr-2" /> : null}
                    <Text className="text-white font-bold text-base">{loading ? "Saving..." : "Save Changes"}</Text>
                </TouchableOpacity>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );
}
