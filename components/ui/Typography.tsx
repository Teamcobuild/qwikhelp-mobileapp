import { Text, TextProps } from "react-native";

interface TypographyProps extends TextProps {
    variant?: "h1" | "h2" | "body" | "caption";
    className?: string; // Allows you to add extra styles if needed
}

export const Typography = ({
    variant = "body",
    className = "",
    children,
    ...props
}: TypographyProps) => {

    // Define default styles for each variant
    const baseStyle = "text-gray-800 font-regular tracking-tighter";

    const variants = {
        h1: "text-3xl font-bold mb-2",
        h2: "text-xl font-semibold mb-1",
        body: "text-base",
        caption: "text-sm text-gray-500",
    };

    return (
        <Text
            className={`${baseStyle} ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </Text>
    );
};