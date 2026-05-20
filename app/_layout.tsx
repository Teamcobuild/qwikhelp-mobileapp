import { ClerkLoaded, ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokenCache } from '../lib/tokenCache';
import { NotificationProvider } from '../context/NotificationContext';
import { LocationProvider } from '../context/LocationContext';
import { LocationModal } from '../components/modals/LocationModal';

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
    const providerVerified = user?.unsafeMetadata?.providerVerified as boolean | undefined;

    const inCustomerTabs = segments[0] === '(customer-tabs)';
    const inProviderTabs = segments[0] === '(provider-tabs)';
    const inOnboarding = segments[0] === '(provider-onboarding)';
    const inAuth = segments[0] === '(auth)';
    const inRoleSelect = segments[0] === 'role-select';
    const inNotifications = segments[0] === 'notifications';

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
      if (!inCustomerTabs && !inNotifications) {
        router.replace('/(customer-tabs)/home');
      }
      return;
    }

    // signed in, role is provider
    if (role === 'provider') {
      if (!providerVerified && !inOnboarding) {
        router.replace('/(provider-onboarding)/id-upload');
        return;
      }
      if (providerVerified && !inProviderTabs) {
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
      <Stack.Screen name="broadcast/new" />
      <Stack.Screen name="dispute/[bookingId]" />
      <Stack.Screen name="notifications" />
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
            </LocationProvider>
          </NotificationProvider>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}