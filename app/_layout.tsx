import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/clerk-expo'; // <--- Import useAuth
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router'; // <--- Import useRouter & useSegments
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokenCache } from '../lib/tokenCache';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

SplashScreen.preventAutoHideAsync();

// 1. Create a separate component for the Auth Logic
function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inTabsGroup = segments[0] === '(tabs)';

    if (isSignedIn && !inTabsGroup) {
      // User is signed in, but not in tabs? Send them there.
      // "replace" kills the back history.
      router.replace('/(tabs)/home');
    } else if (!isSignedIn) {
      // User is NOT signed in? Send them to login.
      // This protects your app if they try to manually type "/home"
      // router.replace('/'); // Optional: strict mode
    }
  }, [isSignedIn, isLoaded]); // Re-run this whenever auth state changes

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      {/* Prevent any back navigation to auth screens */}
      <Stack.Screen
        name="(tabs)"
        options={{
          gestureEnabled: false,
          headerBackVisible: false,
          animationTypeForReplace: 'push', // Prevents animation issues
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  // ... Fonts loading code (same as before) ...
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
          {/* Render the InitialLayout inside the Provider */}
          <InitialLayout />
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}