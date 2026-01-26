import { Ionicons } from "@expo/vector-icons";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Typography } from "../../components/ui/Typography";

export default function HistoryScreen() {
    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView className="px-6 pt-6" showsVerticalScrollIndicator={false}>
                <Typography variant="h1" className="text-2xl font-bold mb-6">
                    Service History
                </Typography>

                {/* Placeholder Content */}
                <View className="flex-1 items-center justify-center py-20">
                    <Ionicons name="time-outline" size={80} color="#D1D5DB" />
                    <Typography variant="h2" className="mt-4 text-gray-400">
                        No History Yet
                    </Typography>
                    <Typography variant="body" className="text-gray-400 text-center mt-2">
                        Your service history will appear here
                    </Typography>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
