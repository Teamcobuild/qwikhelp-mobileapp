import { Button } from "@/components/ui/Button";
import { Typography } from "@/components/ui/Typography";
import { useRouter } from "expo-router";
import { Image, View } from "react-native";

export default function RoleSelectScreen() {
    const router = useRouter();

    const handleSelect = (role: 'customer' | 'provider') => {
        router.push({
            pathname: "/(auth)/sign-up",
            params: { role } // <--- Passing the role dynamically
        });
    };

    return (
        <View className="flex-1 bg-white px-4 justify-center items-center">
            {/* Logo Placeholder */}
            <View className="items-center mb-10">
                <Image
                    source={require("../../assets/images/qwikhelp-logoicon.png")}
                    style={{ width: 120, height: 120 }}
                    resizeMode="contain"
                />
            </View>

            <Typography variant="h2" className="mb-8">Sign Up</Typography>

            <View className="w-full gap-y-4">
                {/* Customer Button */}
                <Button
                    title="Customer"
                    onPress={() => handleSelect('customer')}
                // className="bg-blue-600"
                />

                {/* Provider Button */}
                <Button
                    title="Provider"
                    onPress={() => handleSelect('provider')}
                // className="bg-blue-600"
                />
            </View>

            <View className="flex-row mt-8">
                <Typography variant="caption">Already have an account? </Typography>
                <Typography
                    variant="caption"
                    className="text-blue-600 font-bold"
                    onPress={() => router.push("/(auth)/sign-in")}
                >
                    Login
                </Typography>
            </View>
        </View>
    );
}