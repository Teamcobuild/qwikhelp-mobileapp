import { ClerkLoaded, ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokenCache } from '../lib/tokenCache';
import { NotificationProvider } from '../context/NotificationContext';
import { LocationProvider } from '../context/LocationContext';
import { AvatarProvider } from '../context/AvatarContext';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { LocationModal } from '../components/modals/LocationModal';
import { CustomAlert } from '../components/modals/CustomAlert';
import { ProviderStatus } from '../types/provider';
import { useSupabase } from '../lib/supabase';
import { AnimatedSplash } from '../components/AnimatedSplash';
import * as Sentry from '@sentry/react-native';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Crash reporting for release builds. Off in development and until EXPO_PUBLIC_SENTRY_DSN is set.
Sentry.init({
  dsn: sentryDsn,
  enabled: !!sentryDsn && !__DEV__,
  environment: __DEV__ ? 'development' : 'production',
  sendDefaultPii: false, // no IP addresses or request bodies; we attach only the Clerk user id
  tracesSampleRate: 0.2,
});

SplashScreen.preventAutoHideAsync();

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();
  const supabase = useSupabase();

  // Every signed-in user needs a profiles row (role + display name) before using the backend.
  // Providers also get one from KycContext; this covers customers.
  const role = user?.unsafeMetadata?.role as 'customer' | 'provider' | undefined;

  // Tag crash reports with the account (id + role only) so we can find the user's bookings.
  useEffect(() => {
    Sentry.setUser(user ? { id: user.id } : null);
    Sentry.setTag('role', role ?? 'none');
  }, [user?.id, role]);
  useEffect(() => {
    if (!isSignedIn || !user || role !== 'customer') return;
    supabase
      .from('profiles')
      .upsert(
        { id: user.id, role, full_name: user.fullName, avatar_url: user.imageUrl },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      .then(({ error }) => {
        if (error) console.warn('Profile setup failed:', error.message);
      });
  }, [isSignedIn, user?.id, role, supabase]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && !user) return;

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
    const inRequest = segments[0] === 'request';
    const inVerificationStatus = segments[0] === 'verification-status';
    // Account screens shared by both roles.
    const inAccountScreen = ['edit-profile', 'support', 'settings', 'location', 'assistant', 'messages', 'payment-complete'].includes(segments[0] as string);
    // Terms and privacy are readable by everyone, signed in or not.
    if (segments[0] === 'legal') return;

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
      if (!inCustomerTabs && !inNotifications && !inBooking && !inChat && !inProviderProfile && !inDispute && !inAccountScreen) {
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
      const inProviderAllowed = inProviderTabs || inChat || inNotifications || inDispute || inVerificationStatus || inRequest || inAccountScreen;
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
      <Stack.Screen name="chat/[conversationId]" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="dispute/[bookingId]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="verification-status" />
      <Stack.Screen name="booking/[category]" />
      <Stack.Screen name="request/[jobId]" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="support" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="location" />
      <Stack.Screen name="assistant" />
      <Stack.Screen name="legal/[doc]" />
    </Stack>
  );
}

function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    "Satoshi-Regular": require("../assets/fonts/Satoshi-Regular.otf"),
    "Satoshi-Bold": require("../assets/fonts/Satoshi-Bold.otf"),
  });
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (error) throw error;
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded, error]);

  if (!publishableKey) throw new Error('Missing Publishable Key');
  if (!fontsLoaded) return null;

  // The animated splash sits above the app so routing and Clerk can load underneath it.
  return (
    <View style={{ flex: 1 }}>
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <KeyboardProvider>
          <NotificationProvider>
            <LocationProvider>
              <AvatarProvider>
                <InitialLayout />
                <LocationModal />
                <CustomAlert />
              </AvatarProvider>
            </LocationProvider>
          </NotificationProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
    {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}
    </View>
  );
}

// Catches render errors and reports them (no-op until Sentry is enabled).
export default Sentry.wrap(RootLayout);
