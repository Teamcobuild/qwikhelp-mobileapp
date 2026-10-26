import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ONBOARDING_STEPS, OnboardingStep } from '@/types/provider';

export default function ProviderOnboardingLayout() {
  const segments = useSegments();
  const router = useRouter();
  const { signOut } = useAuth();

  // Find current screen in provider-onboarding
  const currentScreen = (segments[segments.length - 1] || 'personal-details') as OnboardingStep;
  const isPending = currentScreen === 'pending';
  const stepIndex = ONBOARDING_STEPS.indexOf(currentScreen);
  const totalKycSteps = 6;
  const stepNumber = stepIndex >= 0 && stepIndex < totalKycSteps ? stepIndex + 1 : 1;
  const progressPercent = Math.min(100, Math.round((stepNumber / totalKycSteps) * 100));

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (stepIndex > 0) {
      const prevStep = ONBOARDING_STEPS[stepIndex - 1];
      router.replace(`/(provider-onboarding)/${prevStep}` as any);
    } else {
      router.replace('/role-select');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9FAFB]" edges={['top', 'left', 'right']}>
      {!isPending && (
        <View className="px-5 pt-3 pb-2 bg-[#F9FAFB] flex-row items-center justify-between">
          {stepIndex > 0 ? (
            <TouchableOpacity
              onPress={handleBack}
              className="w-10 h-10 rounded-full border border-gray-200 bg-white items-center justify-center shadow-xs"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={20} color="#1F2937" />
            </TouchableOpacity>
          ) : (
            <View className="w-10 h-10" />
          )}

          <View className="flex-row items-center gap-1.5 pr-2">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const isActive = idx <= stepIndex;
              return (
                <View
                  key={idx}
                  className={`h-1 rounded-full ${
                    isActive ? 'bg-blue-600 w-7' : 'bg-blue-100 w-7'
                  }`}
                />
              );
            })}
          </View>
        </View>
      )}

      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="personal-details" />
        <Stack.Screen name="nin-id-upload" />
        <Stack.Screen name="biometric-check" />
        <Stack.Screen name="proof-of-work" />
        <Stack.Screen name="base-terms" />
        <Stack.Screen name="guarantor" />
        <Stack.Screen name="pending" options={{ gestureEnabled: false }} />
      </Stack>
    </SafeAreaView>
  );
}
