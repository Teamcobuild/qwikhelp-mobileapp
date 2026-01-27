// app/(auth)/sign-in.tsx
import { useSignIn } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons"; // Ensure you have this installed
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Image, View } from "react-native";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Typography } from "../../components/ui/Typography";

export default function SignInScreen() {
    const { signIn, setActive, isLoaded } = useSignIn();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const onSignInPress = async () => {
        if (!isLoaded) return;
        setLoading(true);

        try {
            // 1. Attempt Login
            const completeSignIn = await signIn.create({
                identifier: email,
                password,
            });

            // 2. If successful, set the session active
            await setActive({ session: completeSignIn.createdSessionId });

            // 3. Navigate to Home - Clear the entire stack to prevent back navigation
            router.dismissAll();
            router.replace("/(tabs)/home");

        } catch (err: any) {
            // Handle errors (like "Incorrect password")
            Alert.alert("Login Failed", err.errors[0]?.message || "Invalid credentials");
        } finally {
            setLoading(false);
        }
    };

    return (
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

            <Button title="Continue" onPress={onSignInPress} loading={loading} className="bg-blue-600 w-full" />

            {/* Social Login UI */}
            <View className="items-center mt-8">
                <Typography variant="caption" className="text-gray-400 mb-4">or sign up with</Typography>
                <View className="flex-row gap-4">
                    <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center"><Ionicons name="logo-facebook" size={24} color="#1877F2" /></View>
                    <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center"><Ionicons name="logo-apple" size={24} color="black" /></View>
                    <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center"><Ionicons name="logo-google" size={24} color="#DB4437" /></View>
                </View>
            </View>

            <View className="flex-row mt-8 justify-center">
                <Typography variant="caption">Don't have an account? </Typography>
                <Typography
                    variant="caption"
                    className="text-blue-600 font-bold"
                    onPress={() => router.push("/(auth)")} // Go back to Role Select
                >
                    Sign Up
                </Typography>
            </View>
        </View>
    );
}