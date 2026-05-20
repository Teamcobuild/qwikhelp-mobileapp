import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";
import { Typography } from "./Typography";

interface ServiceCardProps {
    title: string;
    description: string;
    iconName: any; // We'll use Ionicons fo now as placeholders
    color?: string; // To give each icon a unique background color if needed
    onPress: () => void;
}

export const ServiceCard = ({ title, description, iconName, color = "bg-blue-100", onPress }: ServiceCardProps) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="bg-white p-4 rounded-2xl mb-4 flex-row items-center"
        >
            <View className={`w-16 h-16 ${color} rounded-xl items-center justify-center mr-4`}>
                <Ionicons name={iconName} size={32} color="#4F46E5" />
            </View>
            <View className="flex-1">
                <Typography variant="h2" className="text-lg font-bold text-gray-900">{title}</Typography>
                <Typography variant="caption" className="text-gray-500 leading-5">
                    {description}
                </Typography>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#000000" />
        </TouchableOpacity>
    );
};