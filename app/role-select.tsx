// app/role-select.tsx
import { Button } from "@/components/ui/Button";
import { Typography } from "@/components/ui/Typography";
import { useUser } from '@clerk/clerk-expo';
import { useRouter } from "expo-router";
import { Image, View } from "react-native";

export default function RoleSelectScreen() {
    const router = useRouter();
    const { user } = useUser();

    const handleSelect = async (role: 'customer' | 'provider') => {
        // Save to Clerk immediately so _layout.tsx 
        // always knows the role even mid-signup
        if (user) {
            await user.update({
                unsafeMetadata: { role }
            });
        }

        router.push({
            pathname: "/(auth)/sign-up",
            params: { role }
        });
    };

    return (
        <View className="flex-1 bg-white px-4 justify-center items-center">
            <View className="items-center mb-10">
                <Image
                    source={require("../assets/images/qwikhelp-logoicon.png")}
                    style={{ width: 120, height: 120 }}
                    resizeMode="contain"
                />
            </View>

            <Typography variant="h1" className="mb-8">Sign Up</Typography>

            <View className="w-full gap-y-4">
                <Button
                    title="Customer"
                    onPress={() => handleSelect('customer')}
                />
                <Button
                    title="Provider"
                    onPress={() => handleSelect('provider')}
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