// Update to components/ui/Input.tsx
import { ReactNode } from "react";
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    rightIcon?: ReactNode; // <--- Add this
    onRightIconPress?: () => void; // <--- Add this
}

export const Input = ({ label, error, rightIcon, onRightIconPress, className = "", ...props }: InputProps) => {
    return (
        <View className="mb-4 w-full">
            {label && <Text className="mb-1 text-gray-600 font-semibold">{label}</Text>}

            <View className={`h-12 bg-white border rounded-lg flex-row items-center px-4 ${error ? "border-red-500" : "border-gray-300 focus:border-blue-600"}`}>
                <TextInput
                    className="flex-1 text-gray-800 h-full"
                    placeholderTextColor="#9CA3AF"
                    {...props}
                />
                {/* Render the icon if provided */}
                {rightIcon && (
                    <TouchableOpacity onPress={onRightIconPress}>
                        {rightIcon}
                    </TouchableOpacity>
                )}
            </View>

            {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
        </View>
    );
};