import { ClerkLoaded, ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokenCache } from '../lib/tokenCache';
import { NotificationProvider } from '../context/NotificationContext';
import { LocationProvider } from '../context/LocationContext';
import { LocationModal } from '../components/modals/LocationModal';
import { CustomAlert } from '../components/modals/CustomAlert';
import { ProviderStatus } from '../types/provider';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

SplashScreen.preventAutoHideAsync();

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && !user) return;

    const role = user?.unsafeMetadata?.role as string | undefined;
    // Written only by the backend (provider-status-sync edge function).
    const providerStatus = user?.publicMetadata?.providerStatus as ProviderStatus | undefined;
    const providerVerified = providerStatus === 'approved';

    const inCustomerTabs = segments[0] === '(customer-tabs)';
    const inProviderTabs = segments[0] === '(provider-tabs)';
    const inOnboarding = segments[0] === '(provider-onboarding)';
    const inAuth = segments[0] === '(auth)';
    const inRoleSelect = segments[0] === 'role-select';
    const inNotifications = segments[0] === 'notifications';
    const inBooking = segments[0] === 'booking';
    const inChat = segments[0] === 'chat';
    const inProviderProfile = segments[0] === 'provider-profile';
    const inDispute = segments[0] === 'dispute';

    if (!isSignedIn) {
      // not signed in — only allow auth screens and role-select
      if (!inAuth && !inRoleSelect) {
        router.replace('/role-select');
      }
      return;
    }

    // signed in but no role yet — send back to role-select
    if (!role) {
      router.replace('/role-select');
      return;
    }

    // signed in, role is customer
    if (role === 'customer') {
      if (!inCustomerTabs && !inNotifications && !inBooking && !inChat && !inProviderProfile && !inDispute) {
        router.replace('/(customer-tabs)/home');
      }
      return;
    }

    // signed in, role is provider
    if (role === 'provider') {
      const inReview = providerStatus === 'submitted' || providerStatus === 'needs_changes' || providerStatus === 'rejected';
      const onboardingStep = inReview
        ? 'pending'
        : (user?.unsafeMetadata?.onboardingStep as string) || 'personal-details';

      if (!providerVerified && !inOnboarding) {
        router.replace(`/(provider-onboarding)/${onboardingStep}` as any);
        return;
      }

      // Allow providers to access provider tabs and shared screens
      const inProviderAllowed = inProviderTabs || inChat || inNotifications || inDispute;
      if (providerVerified && !inProviderAllowed) {
        router.replace('/(provider-tabs)/dashboard');
      }
    }

    // FIX 1: Added 'segments' to this dependency array below
  }, [isSignedIn, isLoaded, user, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="role-select" />

      {/* FIX 2: Added the missing (auth) screen to the stack */}
      <Stack.Screen name="(auth)" />

      <Stack.Screen
        name="(customer-tabs)"
        options={{
          gestureEnabled: false,
          headerBackVisible: false,
          animationTypeForReplace: 'push',
        }}
      />
      <Stack.Screen
        name="(provider-tabs)"
        options={{
          gestureEnabled: false,
          headerBackVisible: false,
          animationTypeForReplace: 'push',
        }}
      />
      <Stack.Screen name="(provider-onboarding)" />
      <Stack.Screen name="provider-profile/[id]" />
      <Stack.Screen name="chat/[bookingId]" />
      <Stack.Screen name="dispute/[bookingId]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="booking/[category]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    "Satoshi-Regular": require("../assets/fonts/Satoshi-Regular.otf"),
    "Satoshi-Bold": require("../assets/fonts/Satoshi-Bold.otf"),
  });

  useEffect(() => {
    if (error) throw error;
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded, error]);

  if (!publishableKey) throw new Error('Missing Publishable Key');
  if (!fontsLoaded) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <NotificationProvider>
            <LocationProvider>
              <InitialLayout />
              <LocationModal />
              <CustomAlert />
            </LocationProvider>
          </NotificationProvider>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}