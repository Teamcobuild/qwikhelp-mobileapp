import { Text, TextInput, TextInputProps, View } from "react-native";

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
}

export const Input = ({ label, error, className = "", ...props }: InputProps) => {
    return (
        <View className="mb-4 w-full">
            {label && <Text className="mb-1 font-bold tracking-tighter text-gray-600">{label}</Text>}

            <TextInput
                className={`h-12 bg-white border rounded-lg px-4 text-gray-800 ${error ? "border-red-500" : "border-gray-300 focus:border-primary"
                    } ${className}`}
                placeholderTextColor="#9CA3AF"
                {...props}
            />

            {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
        </View>
    );
};