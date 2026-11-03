// app/auth/verify-email.tsx
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Typography } from "@/components/ui/Typography";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, View } from "react-native";
import { alertService } from "../../lib/AlertService";
import { clerkErrorMessage } from "../../lib/clerkError";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

export default function VerifyEmail() {
    const { isLoaded, signUp, setActive } = useSignUp();
    const router = useRouter();

    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);

    const onVerifyPress = async () => {
        Keyboard.dismiss();
        if (!isLoaded) return;
        if (!code.trim()) return alertService.alert("Missing code", "Enter the code we emailed you.");
        setLoading(true);

        try {
            // 1. Send the code to Clerk
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code: code.trim(),
            });

            // 2. Check if verification was successful
            if (completeSignUp.status === "complete") {
                // 3. Create the session (Logs the user in!)
                await setActive({ session: completeSignUp.createdSessionId });

                // Clear the navigation stack; root layout guard routes based on user role
                if (router.canDismiss()) {
                    router.dismissAll();
                }
            } else if (completeSignUp.status === "missing_requirements") {
                const missing = completeSignUp.missingFields?.join(", ") || "more details";
                alertService.alert("Sign up incomplete", `Email verified, but your account also needs: ${missing}.`);
            } else {
                alertService.alert("Error", "Verification failed. Please try again.");
            }
        } catch (err: any) {
            alertService.alert("Error", clerkErrorMessage(err, "Invalid code"));
        } finally {
            setLoading(false);
        }
    };

    const onResendPress = async () => {
        if (!isLoaded || resending) return;
        setResending(true);
        try {
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
            alertService.alert("Code sent", `We sent a new code to ${signUp.emailAddress}.`);
        } catch (err: any) {
            alertService.alert("Error", clerkErrorMessage(err, "Could not resend the code"));
        } finally {
            setResending(false);
        }
    };

    return (
        <KeyboardAwareScrollView
            bottomOffset={24}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
            className="flex-1 bg-white"
        >
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
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
            />

            <Button
                title="Verify Email"
                onPress={onVerifyPress}
                loading={loading}
            />

            <View className="items-center mt-6">
                <Typography
                    variant="caption"
                    className="text-blue-600 font-bold"
                    onPress={onResendPress}
                >
                    {resending ? "Sending..." : "Resend code"}
                </Typography>
            </View>
        </View>
        </KeyboardAwareScrollView>
    );
}
