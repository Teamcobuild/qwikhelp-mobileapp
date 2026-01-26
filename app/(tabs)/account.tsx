import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, Image, ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Typography } from "../../components/ui/Typography";

export default function AccountScreen() {
    const { user } = useUser();
    const { signOut } = useAuth();
    const router = useRouter();

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        await signOut();
                        router.dismissAll();
                        router.replace("/(auth)");
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView className="px-6 pt-6" showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <View className="items-center mb-8">
                    <Image
                        source={{ uri: user?.imageUrl }}
                        className="w-24 h-24 rounded-full border-2 border-blue-600"
                    />
                    <Typography variant="h1" className="mt-4 text-2xl font-bold">
                        {user?.firstName} {user?.lastName}
                    </Typography>
                    <Typography variant="body" className="text-gray-500 mt-1">
                        {user?.emailAddresses[0].emailAddress}
                    </Typography>
                </View>

                {/* Account Options */}
                <View className="bg-white rounded-2xl p-2 mb-4">
                    <MenuItem
                        icon="person-outline"
                        title="Edit Profile"
                        onPress={() => console.log("Edit Profile")}
                    />
                    <MenuItem
                        icon="card-outline"
                        title="Payment Methods"
                        onPress={() => console.log("Payment")}
                    />
                    <MenuItem
                        icon="notifications-outline"
                        title="Notifications"
                        onPress={() => console.log("Notifications")}
                    />
                    <MenuItem
                        icon="settings-outline"
                        title="Settings"
                        onPress={() => console.log("Settings")}
                    />
                </View>

                {/* Support Section */}
                <View className="bg-white rounded-2xl p-2 mb-4">
                    <MenuItem
                        icon="help-circle-outline"
                        title="Help Center"
                        onPress={() => console.log("Help")}
                    />
                    <MenuItem
                        icon="shield-checkmark-outline"
                        title="Privacy Policy"
                        onPress={() => console.log("Privacy")}
                    />
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                    onPress={handleLogout}
                    className="bg-red-50 rounded-2xl p-4 flex-row items-center justify-center mb-6"
                >
                    <Ionicons name="log-out-outline" size={24} color="#DC2626" />
                    <Typography variant="h2" className="ml-3 text-red-600 font-bold">
                        Logout
                    </Typography>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

// Helper Component
function MenuItem({ icon, title, onPress }: { icon: any; title: string; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row items-center py-4 px-3 border-b border-gray-100"
        >
            <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                <Ionicons name={icon} size={22} color="#6B7280" />
            </View>
            <Typography variant="body" className="flex-1 ml-4 font-semibold text-gray-900">
                {title}
            </Typography>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
        </TouchableOpacity>
    );
}
