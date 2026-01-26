import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, TextInput, View } from "react-native";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function ForgotPassword() {
    const { signIn, isLoaded, setActive } = useSignIn();
    const router = useRouter();

    const [step, setStep] = useState<"email" | "code" | "password">("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
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
            Alert.alert("Error", err.errors[0]?.message);
        } finally {
            setLoading(false);
        }
    };

    // 2. Submit EVERYTHING (Code + New Password)
    const onResetPassword = async () => {
        if (!isLoaded) return;
        setLoading(true);
        try {
            const result = await signIn.attemptFirstFactor({
                strategy: "reset_password_email_code",
                code, // We use the code collected in Step 2
                password, // We use the password collected in Step 3
            });

            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                Alert.alert("Success", "Password reset successfully!");
                router.replace("/(tabs)/home");
            } else {
                Alert.alert("Error", "Something went wrong.");
            }
        } catch (err: any) {
            Alert.alert("Failed", err.errors[0]?.message || "Invalid Code");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white px-6 pt-12">
            {/* ... Headers (same as before) ... */}

            {step === "email" && (
                <>
                    <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
                    <Button title="Send Code" onPress={onSendCode} loading={loading} className="bg-blue-600 mt-4" />
                </>
            )}

            {step === "code" && (
                <>
                    <View className="w-full mb-6">
                        <TextInput
                            className="w-full h-14 border border-gray-300 rounded-lg text-center text-2xl tracking-widest"
                            keyboardType="numeric"
                            maxLength={6}
                            value={code}
                            onChangeText={setCode}
                            placeholder="000000"
                        />
                    </View>
                    {/* Logic Change: We just move UI to next step, no API call yet */}
                    <Button title="Next" onPress={() => setStep("password")} className="bg-blue-600" />
                </>
            )}

            {step === "password" && (
                <>
                    <Input label="New Password" secureTextEntry value={password} onChangeText={setPassword} />

                    <Button title="Confirm Reset" onPress={onResetPassword} loading={loading} className="bg-blue-600 mt-4" />

                    {/* Helpful 'Back' button if they messed up the code */}
                    <Button title="Back to Code" variant="outline" onPress={() => setStep("code")} className="mt-2" />
                </>
            )}
        </View>
    );
}