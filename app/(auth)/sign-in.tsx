import { useAuth, useSignIn } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Keyboard, View } from "react-native";
import { alertService } from "../../lib/AlertService";
import { clerkErrorMessage } from "../../lib/clerkError";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Typography } from "../../components/ui/Typography";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

export default function SignInScreen() {
    const { signIn, setActive, isLoaded } = useSignIn();
    const { signOut } = useAuth();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    // Set when Clerk wants a code before finishing, e.g. the email code it sends on a new device.
    const [verification, setVerification] = useState<{
        factor: "first" | "second";
        strategy: "email_code" | "phone_code" | "totp";
    } | null>(null);
    const [code, setCode] = useState("");


    // Moves the sign-in forward from whatever status Clerk returned. Returns false if it got stuck.
    const advance = async (result: any): Promise<boolean> => {
        // Not every status is in this SDK's types: "needs_client_trust" is Clerk's new-device check.
        const status = result.status as string;

        // clerk-js swallows failed requests and hands back an empty sign-in, so a null status means Clerk was never reached.
        if (!status) {
            alertService.alert("Can't reach QwikHelp", "We couldn't connect to the sign-in server. Check your internet connection and try again.");
            return false;
        }

        if (status === "complete") {
            setVerification(null);
            await setActive!({ session: result.createdSessionId });
            return true;
        }

        if (status === "needs_second_factor" || status === "needs_client_trust") {
            const factors: any[] = result.supportedSecondFactors ?? [];
            const emailFactor = factors.find((f) => f.strategy === "email_code");
            const phoneFactor = factors.find((f) => f.strategy === "phone_code");
            if (emailFactor) {
                await signIn!.prepareSecondFactor({ strategy: "email_code", emailAddressId: emailFactor.emailAddressId });
                setVerification({ factor: "second", strategy: "email_code" });
                return true;
            }
            if (phoneFactor) {
                await signIn!.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: phoneFactor.phoneNumberId });
                setVerification({ factor: "second", strategy: "phone_code" });
                return true;
            }
            if (factors.some((f) => f.strategy === "totp")) {
                setVerification({ factor: "second", strategy: "totp" });
                return true;
            }
        }

        if (status === "needs_first_factor") {
            const factors: any[] = result.supportedFirstFactors ?? [];
            const emailFactor = factors.find((f) => f.strategy === "email_code");
            const phoneFactor = factors.find((f) => f.strategy === "phone_code");
            if (emailFactor) {
                await signIn!.prepareFirstFactor({ strategy: "email_code", emailAddressId: emailFactor.emailAddressId });
                setVerification({ factor: "first", strategy: "email_code" });
                return true;
            }
            if (phoneFactor) {
                await signIn!.prepareFirstFactor({ strategy: "phone_code", phoneNumberId: phoneFactor.phoneNumberId });
                setVerification({ factor: "first", strategy: "phone_code" });
                return true;
            }
        }

        const first = result.supportedFirstFactors?.map((f: any) => f.strategy).join(", ") || "none";
        const second = result.supportedSecondFactors?.map((f: any) => f.strategy).join(", ") || "none";
        console.warn("Unhandled sign-in status:", status, { first, second });
        alertService.alert(
            "Login Failed",
            __DEV__
                ? `We couldn't finish signing you in (${status}).\nFirst factors: ${first}\nSecond factors: ${second}`
                : `We couldn't finish signing you in (${status}). Please try again.`
        );
        return false;
    };

    const onSignInPress = async (retried = false) => {
        Keyboard.dismiss();
        if (!isLoaded) {
            alertService.alert("Please wait", "Still connecting. Try again in a moment.");
            return;
        }
        const identifier = email.trim();
        if (!identifier || !password) {
            alertService.alert("Missing details", "Enter your email and password.");
            return;
        }
        setLoading(true);

        try {
            const result = await signIn.create({ identifier, password });
            await advance(result);
        } catch (err: any) {
            if (!retried && err?.errors?.[0]?.code === "session_exists") {
                await signOut();
                setLoading(false);
                return onSignInPress(true);
            }
            alertService.alert("Login Failed", clerkErrorMessage(err, "Invalid credentials"));
        } finally {
            setLoading(false);
        }
    };

    const onVerifyCodePress = async () => {
        Keyboard.dismiss();
        if (!isLoaded || !verification) return;
        if (!code.trim()) {
            alertService.alert("Missing code", "Enter the verification code.");
            return;
        }
        setLoading(true);
        try {
            const params = { strategy: verification.strategy, code: code.trim() } as any;
            const result = verification.factor === "first"
                ? await signIn.attemptFirstFactor(params)
                : await signIn.attemptSecondFactor(params);
            setCode("");
            await advance(result);
        } catch (err: any) {
            alertService.alert("Verification failed", clerkErrorMessage(err, "Invalid code"));
        } finally {
            setLoading(false);
        }
    };

    if (verification) {
        return (
            <KeyboardAwareScrollView
                bottomOffset={24}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
                className="flex-1 bg-white"
            >
            <View className="flex-1 bg-white px-4 pt-12 justify-center">
                <Typography variant="h2" className="text-center">Verify it&apos;s you</Typography>
                <Typography variant="body" className="text-center mt-2 mb-8 text-gray-500">
                    {verification.strategy === "email_code"
                        ? `We sent a code to ${email.trim()}.`
                        : verification.strategy === "phone_code"
                            ? "We sent a code to your phone."
                            : "Enter the code from your authenticator app."}
                </Typography>

                <Input
                    placeholder="Enter verification code"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    autoFocus
                />

                <Button title="Verify" onPress={onVerifyCodePress} loading={loading} className="bg-blue-600 w-full" />

                <View className="items-center mt-6">
                    <Typography
                        variant="caption"
                        className="text-blue-600 font-bold"
                        onPress={() => { setVerification(null); setCode(""); }}
                    >
                        Back to login
                    </Typography>
                </View>
            </View>
            </KeyboardAwareScrollView>
        );
    }

    return (
        <KeyboardAwareScrollView
            bottomOffset={24}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
            className="flex-1 bg-white"
        >
        <View className="flex-1 bg-white px-4 pt-12 justify-center">
            <View className="items-center mb-10">
                <Image
                    source={require("../../assets/images/qwikhelp-logoicon.png")}
                    style={{ width: 120, height: 120 }}
                    resizeMode="contain"
                />
            </View>

            <Typography variant="h1" className="text-center">Login</Typography>
            <Typography variant="body" className="text-center mb-8 text-gray-500">
                Welcome back! Please sign in to access your account.
            </Typography>

            <Input
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
            />

            <Input
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword} // Toggle visibility
                rightIcon={<Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="gray" />}
                onRightIconPress={() => setShowPassword(!showPassword)}
            />

            {/* Forgot Password Link */}
            <View className="w-full items-end mb-6">
                <Typography
                    variant="caption"
                    className="text-blue-600 font-bold"
                    onPress={() => router.push("/(auth)/forgot-password")}
                >
                    Forgot Password?
                </Typography>
            </View>

            <Button title="Continue" onPress={() => onSignInPress()} loading={loading} className="bg-blue-600 w-full" />

            <View className="flex-row mt-8 justify-center">
                <Typography variant="caption">Don't have an account? </Typography>
                <Typography
                    variant="caption"
                    className="text-blue-600 font-bold"
                    onPress={() => router.push("/role-select")} // Go back to Role Select
                >
                    Sign Up
                </Typography>
            </View>
        </View>
        </KeyboardAwareScrollView>
    );
}