import { Input } from "@/components/ui/Input";
import { useSignUp } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons"; // For the checkbox checkmark
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { Button } from "../../components/ui/Button";
import { Typography } from "../../components/ui/Typography";

export default function SignUpForm() {
    const { isLoaded, signUp } = useSignUp();
    const router = useRouter();
    const { role } = useLocalSearchParams<{ role: string }>(); // Get role from previous screen

    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: ""
    });
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);

    const onSignUpPress = async () => {
        if (!isLoaded) return;
        if (!agreed) return Alert.alert("Required", "Please agree to the Terms & Conditions");
        if (form.password !== form.confirmPassword) return Alert.alert("Error", "Passwords do not match");

        setLoading(true);
        try {
            // 1. Create User
            await signUp.create({
                firstName: form.firstName,
                lastName: form.lastName,
                emailAddress: form.email,
                password: form.password,
                unsafeMetadata: { role }, // <--- Saving the role here!
            });

            // 2. Start Email Verification
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

            // 3. Move to Verify Screen
            router.push({
                pathname: "/(auth)/verify-email",
                params: { email: form.email }
            });

        } catch (err: any) {
            Alert.alert("Error", err.errors[0]?.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-white px-4 pt-20" showsVerticalScrollIndicator={false}>
            <Typography variant="h1" className="text-center font-bold mb-2">Create Account</Typography>
            <Typography variant="caption" className="text-center mb-8 text-gray-500">
                Fill your information below or register with your social account
            </Typography>

            <Input label="First Name" onChangeText={(t) => setForm({ ...form, firstName: t })} />
            <Input label="Last Name" onChangeText={(t) => setForm({ ...form, lastName: t })} />
            <Input label="Email" keyboardType="email-address" autoCapitalize="none" onChangeText={(t) => setForm({ ...form, email: t })} />
            <Input label="Password" secureTextEntry onChangeText={(t) => setForm({ ...form, password: t })} />
            <Input label="Confirm Password" secureTextEntry onChangeText={(t) => setForm({ ...form, confirmPassword: t })} />

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
                <Typography variant="caption" className="text-gray-400 mb-4">Or sign up with</Typography>
                <View className="flex-row gap-4">
                    {/* You can add Social Login Buttons here later */}
                    <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"><Ionicons name="logo-google" size={20} /></View>
                    <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"><Ionicons name="logo-apple" size={20} /></View>
                </View>
            </View>
        </ScrollView>
    );
}