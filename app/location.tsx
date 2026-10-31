import { useLocation } from "@/context/LocationContext";
import { alertService } from "@/lib/AlertService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

export default function LocationScreen() {
    const router = useRouter();
    const { hasLocationPermission, locationName, coords, refreshLocation, requestPermission, savedPlace, savePlace } = useLocation();

    const [refreshing, setRefreshing] = useState(false);
    const [address, setAddress] = useState(savedPlace?.address ?? "");
    const [landmark, setLandmark] = useState(savedPlace?.landmark ?? "");
    const [saving, setSaving] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshLocation();
        } catch (err: any) {
            alertService.alert("Location", err.message || "Could not get your location.");
        } finally {
            setRefreshing(false);
        }
    };

    const onSave = async () => {
        if (!address.trim() || !landmark.trim()) {
            alertService.alert("Missing details", "Enter both your address and nearest landmark.");
            return;
        }
        setSaving(true);
        try {
            await savePlace({ address: address.trim(), landmark: landmark.trim() });
            alertService.alert("Saved", "We'll fill these in for you when you book a service.");
        } catch {
            alertService.alert("Error", "Could not save your address.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F9FAFB]">
            <View className="flex-row items-center px-4 py-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="p-2 -ml-2 mr-2">
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-lg font-bold text-gray-900">Location</Text>
                {/* Balances the back button so the title stays centred without covering it. */}
                <View className="w-10" />
            </View>

            <View className="flex-1">
                <KeyboardAwareScrollView bottomOffset={24} className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {/* Current location */}
                    <Text className="text-xs font-bold text-gray-500 uppercase mb-2">Current location</Text>
                    <View className="bg-white rounded-[20px] p-5 mb-6">
                        <View className="flex-row items-center">
                            <View className="w-11 h-11 rounded-full bg-orange-50 items-center justify-center mr-3">
                                <Ionicons name="location" size={22} color="#F97316" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-base font-bold text-gray-900">
                                    {hasLocationPermission ? locationName || "Finding your location..." : "Location is off"}
                                </Text>
                                <Text className="text-xs text-gray-500 mt-0.5">
                                    {hasLocationPermission
                                        ? coords
                                            ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                                            : "Used to find providers near you"
                                        : "Turn it on so we can find providers near you"}
                                </Text>
                            </View>
                        </View>

                        {hasLocationPermission ? (
                            <TouchableOpacity
                                onPress={onRefresh}
                                disabled={refreshing}
                                className="mt-4 bg-blue-50 py-3 rounded-xl flex-row items-center justify-center"
                            >
                                {refreshing ? (
                                    <ActivityIndicator size="small" color="#2563EB" />
                                ) : (
                                    <Ionicons name="locate" size={16} color="#2563EB" />
                                )}
                                <Text className="text-blue-600 font-bold text-sm ml-2">Update my location</Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="flex-row gap-2.5 mt-4">
                                <TouchableOpacity onPress={requestPermission} className="flex-1 bg-blue-600 py-3 rounded-xl items-center">
                                    <Text className="text-white font-bold text-sm">Turn on location</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => Linking.openSettings()} className="flex-1 bg-gray-100 py-3 rounded-xl items-center">
                                    <Text className="text-gray-700 font-bold text-sm">Open settings</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Default service address */}
                    <Text className="text-xs font-bold text-gray-500 uppercase mb-2">Default service address</Text>
                    <View className="bg-white rounded-[20px] p-5 mb-4">
                        <Text className="text-gray-700 font-medium mb-2 text-sm">Address</Text>
                        <TextInput
                            value={address}
                            onChangeText={setAddress}
                            placeholder="e.g. 12 Adeola Odeku Street, Victoria Island"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 rounded-xl px-4 py-3.5 text-gray-900 text-sm mb-4"
                        />
                        <Text className="text-gray-700 font-medium mb-2 text-sm">Nearest landmark</Text>
                        <TextInput
                            value={landmark}
                            onChangeText={setLandmark}
                            placeholder="e.g. Opposite Eko Hotel"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 rounded-xl px-4 py-3.5 text-gray-900 text-sm"
                        />
                        <View className="flex-row items-start mt-3">
                            <Ionicons name="lock-closed" size={13} color="#6B7280" style={{ marginTop: 2 }} />
                            <Text className="text-xs text-gray-500 ml-1.5 flex-1">
                                Saved on this phone only. Providers see just the landmark until you confirm a booking.
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={onSave}
                        disabled={saving}
                        className="bg-blue-600 py-4 rounded-xl items-center mb-10 flex-row justify-center"
                    >
                        {saving && <ActivityIndicator color="white" className="mr-2" />}
                        <Text className="text-white font-bold text-base">Save address</Text>
                    </TouchableOpacity>
                </KeyboardAwareScrollView>
            </View>
        </SafeAreaView>
    );
}
