import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useState } from "react";
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    rightIcon?: ReactNode;
    onRightIconPress?: () => void;
}

export const Input = ({ label, error, rightIcon, onRightIconPress, secureTextEntry, className = "", ...props }: InputProps) => {
    // Password fields get a show/hide toggle unless the caller supplies its own icon.
    const [revealed, setRevealed] = useState(false);
    const passwordToggle = secureTextEntry && !rightIcon;

    return (
        <View className="mb-4 w-full">
            {label && <Text className="mb-1 text-gray-600 font-semibold">{label}</Text>}

            <View className={`h-12 bg-white border rounded-lg flex-row items-center px-4 ${error ? "border-red-500" : "border-gray-300 focus:border-blue-600"}`}>
                <TextInput
                    className="flex-1 text-gray-800 h-full"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={passwordToggle ? !revealed : secureTextEntry}
                    {...props}
                />
                {passwordToggle ? (
                    <TouchableOpacity
                        onPress={() => setRevealed((v) => !v)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel={revealed ? "Hide password" : "Show password"}
                    >
                        <Ionicons name={revealed ? "eye-off-outline" : "eye-outline"} size={20} color="#6B7280" />
                    </TouchableOpacity>
                ) : (
                    rightIcon && <TouchableOpacity onPress={onRightIconPress}>{rightIcon}</TouchableOpacity>
                )}
            </View>

            {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
        </View>
    );
};
