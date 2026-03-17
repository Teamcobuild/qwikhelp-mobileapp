// app/auth/verify-email.tsx
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Typography } from "@/components/ui/Typography";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

export default function VerifyEmail() {
    const { isLoaded, signUp, setActive } = useSignUp();
    const router = useRouter();

    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);

    const onVerifyPress = async () => {
        if (!isLoaded) return;
        setLoading(true);

        try {
            // 1. Send the code to Clerk
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code,
            });

            // 2. Check if verification was successful
            if (completeSignUp.status === "complete") {
                // 3. Create the session (Logs the user in!)
                await setActive({ session: completeSignUp.createdSessionId });

                // Clear the navigation stack and go to home
                router.dismissAll();
                router.replace("/(customer-tabs)/home");
            } else {
                Alert.alert("Error", "Verification failed. Please try again.");
            }
        } catch (err: any) {
            Alert.alert("Error", err.errors[0].message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white px-4 pt-4 justify-center">
            <View className="items-center mb-8">
                <Typography variant="h2">Verify your email</Typography>
                <Typography variant="body" className="text-center mt-2 text-gray-500">
                    We sent a code to {signUp?.emailAddress}
                </Typography>
            </View>

            <Input
                placeholder="Enter verification code"
                value={code}
                onChangeText={setCode}
                keyboardType="numeric"
            />

            <Button
                title="Verify Email"
                onPress={onVerifyPress}
                loading={loading}
            />
        </View>
    );
}