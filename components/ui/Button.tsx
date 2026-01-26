import { ActivityIndicator, Text, TouchableOpacity, TouchableOpacityProps } from "react-native";
// component for universal buttons to reduce repetition
interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: "primary" | "outline" | "danger";
    loading?: boolean;
}

export const Button = ({
    title,
    variant = "primary",
    loading = false,
    className = "",
    ...props
}: ButtonProps) => {

    // Background Styles
    const baseButton = "h-12 rounded-xl flex-row items-center justify-center px-4";
    const buttonVariants = {
        primary: "bg-primary",
        outline: "bg-transparent border-2 border-primary",
        danger: "bg-danger",
    };

    // Text Styles
    const baseText = "font-bold tracking-tighter text-lg";
    const textVariants = {
        primary: "text-white",
        outline: "text-primary",
        danger: "text-white",
    };

    return (
        <TouchableOpacity
            className={`${baseButton} ${buttonVariants[variant]} ${className}`}
            disabled={loading} // Disable click when loading
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={variant === "outline" ? "#4F46E5" : "white"} />
            ) : (
                <Text className={`${baseText} ${textVariants[variant]}`}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};