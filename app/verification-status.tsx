import PendingScreen from '@/app/(provider-onboarding)/pending';
import { KycProvider, useKyc } from '@/context/KycContext';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Read-only view of a verified provider's KYC submission (Profile → KYC & Verification Status).
// Lives outside (provider-onboarding) so the routing gate keeps auto-redirecting newly approved
// providers off the onboarding stack.
export default function VerificationStatus() {
  return (
    <KycProvider>
      <SafeAreaView className="flex-1 bg-[#F9FAFB]" edges={['top', 'left', 'right']}>
        <Content />
      </SafeAreaView>
    </KycProvider>
  );
}

function Content() {
  const { ready } = useKyc();
  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }
  return <PendingScreen />;
}
