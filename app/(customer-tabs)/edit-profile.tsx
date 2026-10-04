import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { alertService } from "../../lib/AlertService";

export default function EditProfileScreen() {
    const { user } = useUser();
    const router = useRouter();

    const [firstName, setFirstName] = useState(user?.firstName || "");
    const [lastName, setLastName] = useState(user?.lastName || "");
    const [imageUrl, setImageUrl] = useState(user?.imageUrl || "");
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
                setImageUrl(result.assets[0].uri);
                const mimeType = result.assets[0].uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
                setImageBase64(`data:${mimeType};base64,${result.assets[0].base64}`);
            }
        } catch (error) {
            alertService.alert("Error", "Failed to pick image");
        }
    };

    const handleSave = async () => {
        if (!user) return;
        if (!firstName.trim() || !lastName.trim()) {
            alertService.alert("Error", "First and Last name are required.");
            return;
        }

        setLoading(true);
        try {
            if (imageBase64) {
                await user.setProfileImage({ file: imageBase64 });
            }

            await user.update({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            });

            alertService.alert("Success", "Profile updated successfully!", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (error: any) {
            alertService.alert("Error", error.errors?.[0]?.longMessage || error.message || "Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-row items-center px-4 py-3">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-lg font-bold text-gray-900 -ml-8">Edit Profile</Text>
            </View>

            <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
                <View className="items-center mb-8">
                    <View className="relative">
                        <Image
                            source={{ uri: imageUrl || 'https://via.placeholder.com/150' }}
                            className="w-28 h-28 rounded-full bg-gray-100"
                        />
                        <TouchableOpacity
                            onPress={pickImage}
                            className="absolute bottom-0 right-0 bg-blue-600 w-9 h-9 rounded-full items-center justify-center border-2 border-white"
                        >
                            <Ionicons name="camera" size={18} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="mb-5">
                    <Text className="text-gray-700 font-medium mb-2 text-[15px]">First Name</Text>
                    <TextInput
                        value={firstName}
                        onChangeText={setFirstName}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 text-base"
                        placeholder="Enter your first name"
                    />
                </View>

                <View className="mb-8">
                    <Text className="text-gray-700 font-medium mb-2 text-[15px]">Last Name</Text>
                    <TextInput
                        value={lastName}
                        onChangeText={setLastName}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 text-base"
                        placeholder="Enter your last name"
                    />
                </View>

                <TouchableOpacity
                    onPress={handleSave}
                    disabled={loading}
                    className="w-full bg-blue-600 py-4 rounded-xl items-center shadow-sm mb-10 flex-row justify-center"
                >
                    {loading ? (
                        <ActivityIndicator color="white" className="mr-2" />
                    ) : null}
                    <Text className="text-white font-bold text-base">
                        {loading ? "Saving..." : "Save Changes"}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
