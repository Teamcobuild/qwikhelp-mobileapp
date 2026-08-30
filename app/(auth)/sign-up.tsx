import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Typography } from "@/components/ui/Typography";
import { useAuth, useSignUp } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons"; // For the checkbox checkmark
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { alertService } from "../../lib/AlertService";

export default function SignUpForm() {
    const { isLoaded, signUp } = useSignUp();
    const router = useRouter();
    const params = useLocalSearchParams<{ role: string }>(); // Get role from previous screen
    // Guard: ensure role is a plain string
    const role = Array.isArray(params.role)
        ? params.role[0]
        : params.role;
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: ""
    });
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const { signOut } = useAuth();

    const onSignUpPress = async () => {
        if (!form.firstName || !form.lastName || !form.email || !form.password || !form.confirmPassword) return alertService.alert("Required", "Please fill all fields");
        if (!isLoaded) return;
        if (!agreed) return alertService.alert("Required", "Please agree to the Terms & Conditions");
        if (form.password !== form.confirmPassword) return alertService.alert("Error", "Passwords do not match");
        // Guard: role must exist
        if (!role || !['customer', 'provider'].includes(role)) {
            return alertService.alert("Error", "Invalid role. Please go back and select again.");
        }
        setLoading(true);
        try {
            await signOut();
            // 1. Create User
            await signUp.create({
                firstName: form.firstName,
                lastName: form.lastName,
                emailAddress: form.email,
                password: form.password,
                unsafeMetadata: { role }, // <--- Saving the role here!
            });

            // ✅ Step 2: Send Email Verification
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

            // Step 3: Navigate to OTP Screen - Clear stack to prevent back navigation
            router.push({
                pathname: "/(auth)/verify-email",
                params: { email: form.email },
            });
        } catch (err: any) {
            const errorCode = err.errors?.[0]?.code;

            if (errorCode === 'session_exists') {
                // Session exists — sign out and retry
                await signOut();
                onSignUpPress(); // retry once after signout
                return;
            }
            alertService.alert("Error", err.errors[0]?.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-white px-4 pt-20" showsVerticalScrollIndicator={false}>
            <Typography variant="h1" className="text-center font-bold mb-2">Create Account</Typography>
            <Typography variant="body" className="text-center mb-8 text-gray-500">
                Fill your information below or register with your social account
            </Typography>

            <Input placeholder="First Name" onChangeText={(t) => setForm({ ...form, firstName: t })} />
            <Input placeholder="Last Name" onChangeText={(t) => setForm({ ...form, lastName: t })} />
            <Input placeholder="Email" keyboardType="email-address" autoCapitalize="none" onChangeText={(t) => setForm({ ...form, email: t })} />
            <Input placeholder="Password" secureTextEntry onChangeText={(t) => setForm({ ...form, password: t })} />
            <Input placeholder="Confirm Password" secureTextEntry onChangeText={(t) => setForm({ ...form, confirmPassword: t })} />

            {/* Terms Checkbox */}
            <View className="flex-row items-center mb-6">
                <TouchableOpacity
                    onPress={() => setAgreed(!agreed)}
                    className={`w-5 h-5 border rounded mr-2 items-center justify-center ${agreed ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}
                >
                    {agreed && <Ionicons name="checkmark" size={14} color="white" />}
                </TouchableOpacity>
                <Typography variant="caption">I have agreed with the <Typography variant="caption" className="text-blue-600 underline">Terms & Condition</Typography></Typography>
            </View>

            <Button title="Sign Up" onPress={onSignUpPress} loading={loading} className="bg-blue-600" />

            {/* Social Login Placeholder */}
            <View className="items-center mt-6 mb-10">
                <Typography variant="body" className="text-gray-400 mb-4">Or sign up with</Typography>
                <View className="flex-row gap-4">
                    <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"><Ionicons name="logo-google" size={20} /></View>
                    <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"><Ionicons name="logo-apple" size={20} /></View>
                </View>
            </View>
        </ScrollView>
    );
}