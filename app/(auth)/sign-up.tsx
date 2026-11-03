import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Typography } from "@/components/ui/Typography";
import { useAuth, useSignUp } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons"; // For the checkbox checkmark
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, TouchableOpacity, View } from "react-native";
import { alertService } from "../../lib/AlertService";
import { clerkErrorCode, clerkErrorMessage } from "../../lib/clerkError";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

type Form = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
};

export default function SignUpForm() {
    const { isLoaded, signUp } = useSignUp();
    const { isSignedIn, signOut } = useAuth();
    const router = useRouter();
    const params = useLocalSearchParams<{ role: string }>(); // Get role from previous screen
    // Guard: ensure role is a plain string
    const role = Array.isArray(params.role)
        ? params.role[0]
        : params.role;
    const [form, setForm] = useState<Form>({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: ""
    });
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);

    // Functional update so autofill filling several fields at once doesn't overwrite the others.
    const setField = (key: keyof Form) => (text: string) =>
        setForm((prev) => ({ ...prev, [key]: text }));

    const onSignUpPress = async () => {
        Keyboard.dismiss();
        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();
        const email = form.email.trim();

        if (!firstName || !lastName || !email || !form.password || !form.confirmPassword) {
            return alertService.alert("Required", "Please fill all fields");
        }
        if (form.password !== form.confirmPassword) return alertService.alert("Error", "Passwords do not match");
        if (!agreed) return alertService.alert("Required", "Please agree to the Terms & Conditions");
        // Guard: role must exist
        if (!role || !['customer', 'provider'].includes(role)) {
            return alertService.alert("Error", "Invalid role. Please go back and select again.");
        }
        if (!isLoaded) return alertService.alert("Please wait", "Still connecting. Try again in a moment.");

        setLoading(true);
        try {
            if (isSignedIn) await signOut();

            // 1. Create User
            const result = await signUp.create({
                firstName,
                lastName,
                emailAddress: email,
                password: form.password,
                unsafeMetadata: { role }, // <--- Saving the role here!
            });

            // The instance may ask for fields this form doesn't collect (e.g. phone, username).
            const missing = (result.missingFields ?? []).filter((f) => f !== "email_address");
            if (missing.length) {
                return alertService.alert(
                    "Sign up incomplete",
                    `Your account also needs: ${missing.join(", ")}. This must be turned off in Clerk or added to the form.`
                );
            }

            // ✅ Step 2: Send Email Verification
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

            // Step 3: Navigate to OTP Screen
            router.push({
                pathname: "/(auth)/verify-email",
                params: { email },
            });
        } catch (err: any) {
            if (clerkErrorCode(err) === "form_identifier_exists") {
                return alertService.alert("Account exists", "An account with this email already exists. Please log in instead.");
            }
            alertService.alert("Error", clerkErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAwareScrollView
            bottomOffset={24}
            keyboardShouldPersistTaps="handled"
            className="flex-1 bg-white px-4 pt-20"
            showsVerticalScrollIndicator={false}
        >
            <Typography variant="h1" className="text-center font-bold mb-2">Create Account</Typography>
            <Typography variant="body" className="text-center mb-8 text-gray-500">
                Fill your information below or register with your social account
            </Typography>

            <Input placeholder="First Name" value={form.firstName} onChangeText={setField("firstName")} autoComplete="given-name" textContentType="givenName" />
            <Input placeholder="Last Name" value={form.lastName} onChangeText={setField("lastName")} autoComplete="family-name" textContentType="familyName" />
            <Input
                placeholder="Email"
                value={form.email}
                onChangeText={setField("email")}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
            />
            <Input placeholder="Password" value={form.password} onChangeText={setField("password")} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            <Input placeholder="Confirm Password" value={form.confirmPassword} onChangeText={setField("confirmPassword")} secureTextEntry autoComplete="new-password" textContentType="newPassword" />

            {/* Terms Checkbox */}
            <TouchableOpacity className="flex-row items-center mb-6" onPress={() => setAgreed((a) => !a)} activeOpacity={0.7}>
                <View className={`w-5 h-5 border rounded mr-2 items-center justify-center ${agreed ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}>
                    {agreed && <Ionicons name="checkmark" size={14} color="white" />}
                </View>
                <Typography variant="caption">I have agreed with the <Typography variant="caption" className="text-blue-600 underline">Terms & Condition</Typography></Typography>
            </TouchableOpacity>

            <Button title="Sign Up" onPress={onSignUpPress} loading={loading} className="bg-blue-600" />

            {/* Social Login Placeholder */}
            <View className="items-center mt-6 mb-10">
                <Typography variant="body" className="text-gray-400 mb-4">Or sign up with</Typography>
                <View className="flex-row gap-4">
                    <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"><Ionicons name="logo-google" size={20} /></View>
                    <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"><Ionicons name="logo-apple" size={20} /></View>
                </View>
            </View>
        </KeyboardAwareScrollView>
    );
}
