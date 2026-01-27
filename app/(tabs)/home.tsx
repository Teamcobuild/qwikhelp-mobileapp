import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image, ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ServiceCard } from "../../components/ui/ServiceCard";
import { Typography } from "../../components/ui/Typography";

export default function HomeScreen() {
    const { user } = useUser(); // <--- Fetches the logged-in user data

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView className="px-4 pt-4" showsVerticalScrollIndicator={false}>

                {/* --- HEADER --- */}
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center gap-3">
                        {/* User Profile Image */}
                        <Image
                            source={{ uri: user?.imageUrl }}
                            className="w-12 h-12 rounded-full border border-gray-200"
                        />

                        {/* User Welcome Text */}
                        <View>
                            <Typography variant="h2" className="text-xl font-bold text-gray-900">
                                Welcome, {user?.firstName || "User"} 👋
                            </Typography>
                        </View>
                    </View>

                    {/* Notification Bell */}
                    <TouchableOpacity className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-100 shadow-sm">
                        <Ionicons name="notifications-outline" size={20} color="black" />
                    </TouchableOpacity>
                </View>


                {/* --- SERVICES LIST --- */}
                <View className="pb-24">
                    <ServiceCard
                        title="Cooking"
                        description="Quick access to a cook to cater for your feeding."
                        iconName="restaurant"
                        color="bg-orange-100"
                        onPress={() => console.log("Cooking")}
                    />

                    <ServiceCard
                        title="Cleaning"
                        description="Quick access to cleaning agents in your desired location."
                        iconName="water"
                        color="bg-blue-100"
                        onPress={() => console.log("Cleaning")}
                    />

                    <ServiceCard
                        title="Laundry"
                        description="Quick access to personnel for your laundry maintenance."
                        iconName="shirt"
                        color="bg-purple-100"
                        onPress={() => console.log("Laundry")}
                    />

                    <ServiceCard
                        title="Companion"
                        description="Quick access to a companion in your time of loneliness."
                        iconName="people"
                        color="bg-pink-100"
                        onPress={() => console.log("Companion")}
                    />

                    <ServiceCard
                        title="Tour Guide"
                        description="Quick access to a tour guide to help you navigate."
                        iconName="map"
                        color="bg-green-100"
                        onPress={() => console.log("Tour Guide")}
                    />
                </View>

            </ScrollView>

            {/* --- FLOATING ACTION BUTTON (The Blue Sparkle) --- */}
            <TouchableOpacity
                className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg shadow-blue-300"
                activeOpacity={0.8}
            >
                <Ionicons name="sparkles" size={24} color="white" />
            </TouchableOpacity>

        </SafeAreaView>
    );
}