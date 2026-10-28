import { Button } from '@/components/ui/Button';
import { Typography } from '@/components/ui/Typography';
import { alertService } from '@/lib/AlertService';
import { docTitle, tradeName } from '@/constants/kyc';
import { useKyc } from '@/context/KycContext';
import { OnboardingStep, ProviderPublicMetadata, ProviderStatus } from '@/types/provider';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  AppState,
  BackHandler,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface SectionOption {
  step: OnboardingStep;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ONBOARDING_SECTIONS: SectionOption[] = [
  {
    step: 'personal-details',
    title: '1. Personal Details & Trade',
    subtitle: 'Legal name, avatar, bio, trade category',
    icon: 'person-outline',
  },
  {
    step: 'nin-id-upload',
    title: '2. Identity Verification & NIN',
    subtitle: 'Document type, NIN/BVN, DOB, ID photo',
    icon: 'card-outline',
  },
  {
    step: 'biometric-check',
    title: '3. Biometric Liveness Check',
    subtitle: 'Live facial recognition selfie',
    icon: 'camera-outline',
  },
  {
    step: 'proof-of-work',
    title: '4. Show Your Work',
    subtitle: 'Uploaded completed job photos',
    icon: 'images-outline',
  },
  {
    step: 'base-terms',
    title: '5. Workshop / Home Base',
    subtitle: 'GPS coordinates, storefront photo, terms',
    icon: 'business-outline',
  },
  {
    step: 'guarantor',
    title: '6. Guarantor Information',
    subtitle: 'Guarantor name, contact, address & NIN',
    icon: 'people-outline',
  },
];

interface StatusCopy {
  title: string;
  body: string;
  pill: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const SUBMITTED_COPY: StatusCopy = {
  title: 'Application Under Review',
  body: 'Thank you for submitting your verification details. We are carefully reviewing your documents to keep QwikHelp safe and trusted.',
  pill: 'Pending Verification',
  icon: 'hourglass-outline',
};

const STATUS_COPY: Record<ProviderStatus, StatusCopy> = {
  draft: SUBMITTED_COPY,
  submitted: SUBMITTED_COPY,
  needs_changes: {
    title: 'Updates Needed',
    body: 'Our team needs you to update some of your details. Tap Edit Details, fix the sections below, and resubmit.',
    pill: 'Action Required',
    icon: 'alert-circle-outline',
  },
  rejected: {
    title: 'Application Not Approved',
    body: 'We could not verify your provider account. Contact support if you believe this is a mistake.',
    pill: 'Not Approved',
    icon: 'close-circle-outline',
  },
  approved: {
    title: "You're Verified",
    body: 'Your identity and documents have been verified. You can go online and receive job requests.',
    pill: 'Verified',
    icon: 'shield-checkmark-outline',
  },
};

export default function PendingScreen() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const { kyc: kycData, status, reviewNote, reload, syncClerkStatus } = useKyc();
  const segments = useSegments();
  const copy = STATUS_COPY[status];
  const isApproved = status === 'approved';
  const canEdit = status === 'draft' || status === 'submitted' || status === 'needs_changes';

  // Re-check when the provider returns to the app (e.g. after an approval push).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => sub.remove();
  }, [reload]);

  // Prevent routing back via hardware back button on Android
  useEffect(() => {
    const onBackPress = () => {
      // Disallow back navigation while under review; verified providers viewing their status can leave.
      return !isApproved;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );
    return () => subscription.remove();
  }, [isApproved]);

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      const latest = await reload();

      if (latest === 'approved') {
        // The onboarding layout syncs Clerk and the root gate redirects to the dashboard.
        alertService.alert('Congratulations!', 'Your provider account has been approved.');
      } else if (latest === 'submitted') {
        alertService.alert(
          'Still Under Review',
          'Your documents are currently undergoing review by our compliance team. We typically respond within 24 to 48 hours.'
        );
      } else if (!latest) {
        alertService.alert('Error', 'Could not verify status. Please check your internet connection.');
      }
    } catch (err: any) {
      alertService.alert(
        'Error',
        err.message || 'Could not verify status. Please check your internet connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = async () => {
    const clerkStatus = (user?.publicMetadata as ProviderPublicMetadata | undefined)?.providerStatus;
    if (clerkStatus === 'approved') {
      if (segments[0] === 'verification-status' && router.canGoBack()) router.back();
      else router.replace('/(provider-tabs)/dashboard');
      return;
    }

    // Clerk hasn't caught up with the approval yet; sync it. The root gate redirects once it lands.
    setLoading(true);
    try {
      const synced = await syncClerkStatus();
      if (synced !== 'approved') {
        alertService.alert('Not Approved Yet', 'Your account is not approved yet. Please check again shortly.');
      }
    } catch (err: any) {
      alertService.alert('Could not open dashboard', err.message || 'Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSection = (step: OnboardingStep) => {
    setEditModalVisible(false);
    router.push(`/(provider-onboarding)/${step}` as any);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/role-select');
  };

  return (
    <ScrollView
      className="flex-1 bg-[#F9FAFB] px-6 pt-10"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="items-center mt-6">
        {/* Verification Icon Badge */}
        <View className="w-24 h-24 rounded-full bg-blue-50 items-center justify-center mb-6">
          <Ionicons name={copy.icon} size={48} color="#2563EB" />
        </View>

        <Typography variant="h1" className="text-gray-900 font-bold text-center mb-2">
          {copy.title}
        </Typography>
        <Typography
          variant="body"
          className="text-gray-500 text-center text-sm mb-6 px-4 leading-5"
        >
          {copy.body}
        </Typography>

        {reviewNote && (status === 'needs_changes' || status === 'rejected') && (
          <View className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
            <Text className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Reviewer note</Text>
            <Text className="text-sm text-amber-900 leading-5">{reviewNote}</Text>
          </View>
        )}

        {/* Application Summary Card */}
        <View className="w-full bg-white rounded-2xl p-5 mb-5 shadow-2xs">
          <View className="flex-row justify-between items-center mb-3.5 pb-2.5">
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Submission Summary
            </Text>
            {canEdit && (
              <TouchableOpacity
                onPress={() => setEditModalVisible(true)}
                className="flex-row items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg"
              >
                <Ionicons name="create-outline" size={13} color="#2563EB" />
                <Text className="text-xs font-bold text-blue-600">Edit Details</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="gap-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-gray-500">Service Category</Text>
              <Text className="text-xs font-semibold text-gray-800">
                {tradeName(kycData.trade) || 'General Provider'}
              </Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-gray-500">Legal Name</Text>
              <Text className="text-xs font-semibold text-gray-800">
                {kycData.legalName || user?.fullName || 'Registered'}
              </Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-gray-500">Identity Verification</Text>
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text className="text-xs font-medium text-emerald-700 ml-1">
                  {docTitle(kycData.idType) || 'NIN & ID Attached'}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-gray-500">Biometric Check</Text>
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text className="text-xs font-medium text-emerald-700 ml-1">
                  Completed
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-gray-500">Workshop & Base</Text>
              <Text className="text-xs font-semibold text-gray-800">
                {kycData.city || kycData.baseAddress || 'Location Verified'}
              </Text>
            </View>

            <View className="flex-row justify-between items-center pt-1">
              <Text className="text-xs text-gray-500">Status</Text>
              <View className={`px-2.5 py-0.5 rounded-full ${isApproved ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                <Text className={`text-[11px] font-semibold ${isApproved ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {copy.pill}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Info Box */}
        {!isApproved && (
          <View className="w-full bg-blue-50/70 rounded-2xl p-4 flex-row items-start">
            <Ionicons name="time-outline" size={20} color="#2563EB" className="mt-0.5" />
            <View className="ml-3 flex-1">
              <Text className="text-xs font-bold text-blue-900 mb-0.5">
                Typical turnaround: 24 - 48 hours
              </Text>
              <Text className="text-xs text-blue-700 leading-4">
                Once verified, your dashboard and client job feed will be automatically activated. You can make corrections anytime while under review.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {isApproved ? (
        <View className="w-full mt-6">
          <Button
            title="Go to Dashboard"
            onPress={handleGoToDashboard}
            loading={loading}
            className="bg-blue-600 shadow-sm"
          />
        </View>
      ) : (
        <View className="w-full mt-6 gap-3">
          <Button
            title="Check Verification Status"
            onPress={handleCheckStatus}
            loading={loading}
            className="bg-blue-600 shadow-sm"
          />

          {canEdit && (
            <TouchableOpacity
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.8}
              className="h-14 bg-white border-2 border-blue-600 rounded-xl flex-row items-center justify-center shadow-2xs"
            >
              <Ionicons name="create-outline" size={18} color="#2563EB" className="mr-2" />
              <Text className="text-blue-600 font-bold text-base">
                Make Corrections
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleSignOut}
            className="py-2.5 items-center justify-center"
          >
            <Text className="text-sm font-semibold text-gray-500">
              Sign Out / Switch Account
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Select Section to Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-3xl p-5 pb-8 max-h-[85%]">
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <Text className="text-lg font-bold text-gray-900 mb-1 text-center">
              Make Corrections
            </Text>
            <Text className="text-xs text-gray-500 mb-4 text-center px-4">
              Select the section you want to review or update. All your previously submitted details are preserved.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-2">
              {ONBOARDING_SECTIONS.map((section) => (
                <TouchableOpacity
                  key={section.step}
                  onPress={() => handleSelectSection(section.step)}
                  className="flex-row items-center p-3.5 bg-gray-50 rounded-xl mb-2.5"
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                    <Ionicons name={section.icon} size={20} color="#2563EB" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900">
                      {section.title}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                      {section.subtitle}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setEditModalVisible(false)}
              className="py-3 items-center bg-gray-100 rounded-xl mt-1"
            >
              <Text className="text-sm font-semibold text-gray-600">Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}
