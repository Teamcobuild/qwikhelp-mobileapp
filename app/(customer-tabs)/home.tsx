import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ServiceCard } from "../../components/ui/ServiceCard";
import { Typography } from "../../components/ui/Typography";
import { useLocation } from "../../context/LocationContext";
import { useNotifications } from "../../context/NotificationContext";

export default function HomeScreen() {
    const { user } = useUser(); // fetch the logged-in user data
    const router = useRouter();
    const { unreadCount } = useNotifications();
    const { locationName } = useLocation();

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView className="px-4 pt-4" showsVerticalScrollIndicator={false}>

                {/* header */}
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center gap-3">
                        {/* user profile image */}
                        <Image
                            source={{ uri: user?.imageUrl }}
                            className="w-12 h-12 rounded-full border border-gray-200"
                        />

                        {/* user welcome text */}
                        <View className="mt-1 flex-col items-start ">
                            <Typography variant="h2" className="text-xl font-bold text-gray-900">
                                Welcome, {user?.firstName || "User"}
                            </Typography>
                            <View className="flex-row w-fit items-center justify-center bg-green-100 px-2 py-1 rounded-full">
                                {/* <Ionicons name="location" size={12} color="#14a800" /> */}
                                <Text className="text-[10px] font-medium text-green-900 ml-1">
                                    {locationName || "Locating..."}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* notification bell */}
                    <TouchableOpacity
                        onPress={() => router.push("/notifications")}
                        className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-100 relative"
                    >
                        <Ionicons name="notifications-outline" size={20} color="black" />
                        {unreadCount > 0 && (
                            <View className="absolute -top-1 -right-1 bg-red-500 w-5 h-5 rounded-full items-center justify-center border-2 border-[#FAFAFA]">
                                <Text className="text-white text-[10px] font-bold">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>


                {/* services list */}
                <View className="pb-24">
                    <ServiceCard
                        title="Cooking"
                        description="Quick access to a cook to cater for your feeding."
                        iconName="restaurant"
                        color="bg-orange-100"
                        onPress={() => router.push("/booking/cooking")}
                    />

                    <ServiceCard
                        title="Cleaning"
                        description="Quick access to cleaning agents in your desired location."
                        iconName="water"
                        color="bg-blue-100"
                        onPress={() => router.push("/booking/cleaning")}
                    />

                    <ServiceCard
                        title="Laundry"
                        description="Quick access to personnel for your laundry maintenance."
                        iconName="shirt"
                        color="bg-purple-100"
                        onPress={() => router.push("/booking/laundry")}
                    />

                    <ServiceCard
                        title="Companion"
                        description="Quick access to a companion in your time of loneliness."
                        iconName="people"
                        color="bg-pink-100"
                        onPress={() => router.push("/booking/companion")}
                    />

                    <ServiceCard
                        title="Tour Guide"
                        description="Quick access to a tour guide to help you navigate."
                        iconName="map"
                        color="bg-green-100"
                        onPress={() => router.push("/booking/tour-guide")}
                    />
                    <ServiceCard
                        title="Plumber"
                        description="Quick access to a plumber to help you fix pipe and drainage problems asap."
                        iconName="build"
                        color="bg-yellow-100"
                        onPress={() => router.push("/booking/plumber")}
                    />
                    <ServiceCard
                        title="Electrician"
                        description="Quick access to an electrician to help you fix wiring problems asap."
                        iconName="bulb"
                        color="bg-gray-100"
                        onPress={() => router.push("/booking/electrician")}
                    />
                    <ServiceCard
                        title="Gardeners"
                        description="Quick access to a gardener to help you maintain your environment."
                        iconName="leaf"
                        color="bg-blue-100"
                        onPress={() => router.push("/booking/gardeners")}
                    />
                </View>

            </ScrollView>

            {/* floating assistant button */}
            <TouchableOpacity
                className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg shadow-blue-300"
                activeOpacity={0.8}
            >
                <Ionicons name="sparkles" size={24} color="white" />
            </TouchableOpacity>

        </SafeAreaView>
    );
}