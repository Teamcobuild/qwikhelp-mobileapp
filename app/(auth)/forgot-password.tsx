import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { alertService } from "../../lib/AlertService";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Typography } from "../../components/ui/Typography"; // Verify this path matches your setup

export default function ForgotPassword() {
    const { signIn, isLoaded, setActive } = useSignIn();
    const router = useRouter();
    const [step, setStep] = useState<"email" | "code" | "password">("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // 1. Send the OTP
    const onSendCode = async () => {
        if (!isLoaded) return;
        setLoading(true);
        try {
            await signIn.create({
                strategy: "reset_password_email_code",
                identifier: email,
            });
            setStep("code"); // Move to OTP input
        } catch (err: any) {
            alertService.alert("Error", err.errors[0]?.message);
        } finally {
            setLoading(false);
        }
    };

    const validateForm = () => {
        if (!password || !confirmPassword) {
            alertService.alert("Error", "Passwords cannot be empty");
            return false;
        }
        if (confirmPassword !== password) {
            alertService.alert("Error", "Passwords do not match");
            return false;
        }
        return true;
    }

    // 2. Submit everything (Code + New Password)
    const onResetPassword = async () => {
        // FIX 1: Added () to validateForm so the gatekeeper actually runs
        if (!isLoaded || !validateForm()) return;

        setLoading(true);
        try {
            const result = await signIn.attemptFirstFactor({
                strategy: "reset_password_email_code",
                code, // using the code collected in Step 2
                password, // using the password collected in Step 3
            });

            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                alertService.alert("Success", "Password Reset Successfully!");

                // FIX 2: Route to root so _layout.tsx sorts Customer vs Provider
                router.replace("/");
            } else {
                alertService.alert("Error", "Something Went Wrong!");
            }
        } catch (err: any) {
            alertService.alert("Failed", err.errors[0]?.message || "Invalid Code");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white px-4 pt-12">
            {step === "email" && (
                <View className="flex flex-col">
                    <Typography variant="h2" className="text-center font-bold mb-4">Forgot Password</Typography>
                    <Input placeholder="input your email" value={email} onChangeText={setEmail} autoCapitalize="none" />
                    <Button title="Send Code" onPress={onSendCode} loading={loading} className="bg-blue-600" />
                </View>
            )}

            {step === "code" && (
                <>
                    <View className="w-full pb-2 pt-4">
                        <Typography variant="h2" className="text-center font-bold mb-4">Verification</Typography>
                        <Typography variant="body" className="text-center font-bold mb-4">We have sent a verification code to "{email}"</Typography>
                        <TextInput
                            className="w-full h-14 border border-gray-300 rounded-lg text-center  text-2xl tracking-widest"
                            keyboardType="numeric"
                            maxLength={6}
                            value={code}
                            onChangeText={setCode}
                            placeholder="Input Code"
                        />
                    </View>
                    <Button title="Next" onPress={() => setStep("password")} className="bg-blue-600" />
                </>
            )}

            {step === "password" && (
                <>
                    <Typography variant="h2" className="text-center font-bold mb-4">New Password</Typography>
                    <Input secureTextEntry value={password} onChangeText={setPassword} placeholder="Input Password" />
                    <Input secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm Password" />

                    <Button title="Confirm Reset" onPress={onResetPassword} loading={loading} className="bg-blue-600 mt-4" />

                    {/* Helpful 'Back' button if they messed up the code */}
                    <Button title="Back to Code" variant="outline" onPress={() => setStep("code")} className="mt-2" />
                </>
            )}
        </View>
    );
}