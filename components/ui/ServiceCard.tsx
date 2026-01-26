import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";
import { Typography } from "./Typography";

interface ServiceCardProps {
    title: string;
    description: string;
    iconName: any; // We'll use Ionicons for now as placeholders
    color?: string; // To give each icon a unique background color if needed
    onPress: () => void;
}

export const ServiceCard = ({ title, description, iconName, color = "bg-blue-100", onPress }: ServiceCardProps) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="bg-white p-4 rounded-2xl mb-4 flex-row items-center shadow-sm border border-gray-100"
        >
            {/* 1. Illustration Placeholder */}
            <View className={`w-16 h-16 ${color} rounded-xl items-center justify-center mr-4`}>
                <Ionicons name={iconName} size={32} color="#4F46E5" />
            </View>

            {/* 2. Text Content */}
            <View className="flex-1">
                <Typography variant="h2" className="text-lg font-bold text-gray-900">{title}</Typography>
                <Typography variant="caption" className="text-gray-500 leading-5 mt-1">
                    {description}
                </Typography>
            </View>

            {/* 3. Arrow Icon */}
            <Ionicons name="chevron-forward" size={20} color="#E5E7EB" />
        </TouchableOpacity>
    );
};