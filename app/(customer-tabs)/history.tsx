import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CATEGORIES = ["All", "Upcoming", "Completed", "Pending", "Canceled"];

// const MOCK_DATA: any[] = [];

const MOCK_DATA = [
    {
        id: "1",
        providerName: "Ahmed Ali",
        serviceName: "Cooking Service",
        time: "Waiting....",
        status: "Pending",
    },
    {
        id: "2",
        providerName: "Chidi Jude",
        serviceName: "Laundry",
        time: "Today 4:00pm",
        status: "Confirmed",
    },
    {
        id: "3",
        providerName: "Eslam Magdy",
        serviceName: "House Cleaning",
        time: "Today 1:00pm",
        status: "Canceled",
    },
    {
        id: "4",
        providerName: "Chidi Jude",
        serviceName: "Laundry",
        time: "Yesterday 4:00pm",
        status: "Completed",
    },
];


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
    const [selectedCategory, setSelectedCategory] = useState("All");

    const filteredData = MOCK_DATA.filter((item) => {
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
            <View className="px-4 pt-2 pb-6">
                <Text className="text-xl font-bold text-center text-gray-900">
                    Booking History
                </Text>
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

            {isEmpty ? (
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
                >
                    {filteredData.map((item) => {
                        const colors = getStatusColor(item.status);
                        return (
                            <View
                                key={item.id}
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
                                    <TouchableOpacity
                                        className={`w-12 h-12 rounded-full items-center justify-center ${colors.iconBg}`}
                                    >
                                        <Ionicons
                                            name="call"
                                            size={20}
                                            color={colors.iconColor}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                    <View className="h-10" />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
