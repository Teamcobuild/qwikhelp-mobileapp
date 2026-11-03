import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";
import { SERVICE_ICONS } from "../illustrations/ServiceIcons";
import { Typography } from "./Typography";

interface ServiceCardProps {
    title: string;
    description: string;
    slug: string; // services.ts slug; picks the animated illustration
    color?: string; // To give each icon a unique background color if needed
    onPress: () => void;
}

export const ServiceCard = ({ title, description, slug, color = "bg-blue-100", onPress }: ServiceCardProps) => {
    const Icon = SERVICE_ICONS[slug];
    return (
        <TouchableOpacity
            onPress={onPress}
            className="bg-white p-4 rounded-2xl mb-4 flex-row items-center"
        >
            <View className={`w-16 h-16 ${color} rounded-xl items-center justify-center mr-4`}>
                {Icon ? <Icon size={48} /> : <Ionicons name="construct" size={32} color="#4F46E5" />}
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
