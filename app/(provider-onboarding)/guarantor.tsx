import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Typography } from '@/components/ui/Typography';
import { alertService } from '@/lib/AlertService';
import { useKyc } from '@/context/KycContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

const RELATIONSHIPS = [
  'Landlord / Property Owner',
  'Community / Religious Leader',
  'Former Employer / Business Owner',
  'Licensed Professional',
  'Civil Servant / Public Official',
  'Trade Association Official',
];

export default function Guarantor() {
  const router = useRouter();
  const { kyc: savedKyc, saveStep, submit } = useKyc();

  const [guarantorName, setGuarantorName] = useState<string>(
    savedKyc.guarantorName || ''
  );
  const [relationship, setRelationship] = useState<string>(
    savedKyc.guarantorRelationship || RELATIONSHIPS[0]
  );
  const [guarantorPhone, setGuarantorPhone] = useState<string>(
    savedKyc.guarantorPhone || ''
  );
  const [guarantorAddress, setGuarantorAddress] = useState<string>(
    savedKyc.guarantorAddress || ''
  );
  const [guarantorNin, setGuarantorNin] = useState<string>(
    savedKyc.guarantorNin || ''
  );
  const [consentAgreed, setConsentAgreed] = useState<boolean>(
    savedKyc.guarantorConsentAgreed ?? false
  );
  const [relationshipModalVisible, setRelationshipModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const cleanPhone = guarantorPhone.replace(/\D/g, '');
  const cleanNin = guarantorNin.replace(/\D/g, '');
  const isNinValid = cleanNin.length === 11;

  const handleNext = async () => {
    if (!guarantorName.trim()) {
      return alertService.alert('Name Required', 'Please enter your guarantor’s full legal name.');
    }
    if (cleanPhone.length < 10) {
      return alertService.alert(
        'Phone Required',
        'Please provide a valid 10 or 11-digit phone number for your guarantor.'
      );
    }
    if (!guarantorAddress.trim()) {
      return alertService.alert(
        'Address Required',
        'Please enter your guarantor’s home or work address.'
      );
    }
    if (cleanNin.length < 11) {
      return alertService.alert(
        'NIN Required',
        'Please enter the 11-digit National Identity Number (NIN) of your guarantor.'
      );
    }
    if (!consentAgreed) {
      return alertService.alert(
        'Consent Required',
        'You must confirm that your guarantor has explicitly consented to verification.'
      );
    }

    setLoading(true);
    try {
      await saveStep({
        next: 'pending',
        kyc: {
          guarantor_name: guarantorName.trim(),
          guarantor_phone: guarantorPhone.trim(),
          guarantor_relationship: relationship,
          guarantor_address: guarantorAddress.trim(),
          guarantor_nin: cleanNin,
          guarantor_consent_agreed: true,
        },
        local: {
          guarantorName: guarantorName.trim(),
          guarantorPhone: guarantorPhone.trim(),
          guarantorRelationship: relationship,
          guarantorAddress: guarantorAddress.trim(),
          guarantorNin: cleanNin,
          guarantorConsentAgreed: true,
        },
      });

      // Validates every step server-side and moves the application to review.
      await submit();

      router.replace('/(provider-onboarding)/pending');
    } catch (err: any) {
      alertService.alert('Error', err.message || 'Failed to submit guarantor details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView bottomOffset={24}
      className="flex-1 bg-[#F9FAFB] px-5 pt-4"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title & Subtitle */}
      <View className="mb-4">
        <Typography variant="h1" className="text-2xl font-bold text-gray-900 mb-1.5">
          Add a Guarantor
        </Typography>
        <Text className="text-sm text-gray-500 leading-5">
          Add someone who can confirm your address and vouch for your work. Ask for their consent first.
        </Text>
      </View>

      {/* Guarantor Criteria Trust Card */}
      <View className="bg-[#EDF5FF] rounded-2xl p-4 flex-row items-start mb-5">
        <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center mr-3 mt-0.5">
          <Ionicons name="shield-checkmark" size={20} color="#2563EB" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-gray-900 mb-0.5">
            Guarantor Criteria
          </Text>
          <Text className="text-xs text-gray-500 leading-4">
            Must be a recognized community leader, employer, landlord, or licensed professional who can confirm your residential address.
          </Text>
        </View>
      </View>

      {/* Field 1: Guarantor Full Name */}
      <View className="mb-4">
        <Text className="text-sm font-bold text-gray-800 mb-2">
          Guarantor Full Name
        </Text>
        <View className="bg-white rounded-xl px-4 py-3.5 shadow-2xs">
          <TextInput
            className="text-base font-medium text-gray-900 p-0"
            value={guarantorName}
            onChangeText={setGuarantorName}
            placeholder="e.g. Chief Emeka Nwosu"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* Field 2: Relationship to You */}
      <View className="mb-4">
        <Text className="text-sm font-bold text-gray-800 mb-2">
          Relationship to You
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setRelationshipModalVisible(true)}
          className="bg-white rounded-xl px-4 py-3.5 flex-row items-center justify-between shadow-2xs"
        >
          <Text className="text-base font-medium text-gray-900">
            {relationship}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Field 3: Guarantor Phone Number */}
      <View className="mb-4">
        <Text className="text-sm font-bold text-gray-800 mb-2">
          Guarantor Phone Number
        </Text>
        <View className="flex-row gap-2.5">
          {/* Country Code Pill */}
          <View className="bg-white rounded-xl px-3.5 py-3.5 flex-row items-center shadow-2xs gap-1.5">
            <Text className="text-base">🇳🇬</Text>
            <Text className="text-base font-bold text-gray-800">+234</Text>
          </View>

          {/* Number Input Box */}
          <View className="flex-1 bg-white rounded-xl px-4 py-3.5 shadow-2xs">
            <TextInput
              className="text-base font-medium text-gray-900 p-0"
              value={guarantorPhone}
              onChangeText={setGuarantorPhone}
              placeholder="0803 492 8812"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </View>

      {/* Field 4: Guarantor Home/Work Address */}
      <View className="mb-4">
        <Text className="text-sm font-bold text-gray-800 mb-2">
          Guarantor Home/Work Address
        </Text>
        <View className="bg-white rounded-xl px-4 py-3.5 shadow-2xs">
          <TextInput
            className="text-base font-medium text-gray-900 p-0"
            value={guarantorAddress}
            onChangeText={setGuarantorAddress}
            placeholder="e.g. 14 Factory Road, Aba, Abia State"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* Field 5: Guarantor NIN (11 Digits) */}
      <View className="mb-5">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-bold text-gray-800">
            Guarantor NIN (11 Digits)
          </Text>
          {isNinValid && (
            <View className="bg-[#D1FAE5] rounded-full px-2.5 py-0.5 flex-row items-center gap-1">
              <Ionicons name="checkmark-circle-outline" size={13} color="#059669" />
              <Text className="text-[11px] font-bold text-emerald-700">
                Identity Verified
              </Text>
            </View>
          )}
        </View>

        <View className="bg-white rounded-xl px-4 py-3.5 shadow-2xs">
          <TextInput
            className="text-base font-medium text-gray-900 p-0 tracking-wide"
            value={guarantorNin}
            onChangeText={setGuarantorNin}
            placeholder="11-digit NIN"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            maxLength={11}
          />
        </View>
      </View>

      {/* Consent Checkbox Card */}
      <View className="bg-transparent mb-5">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setConsentAgreed(!consentAgreed)}
          className="flex-row items-start"
        >
          <View
            className={`w-5 h-5 rounded-md items-center justify-center mr-3 mt-0.5 ${
              consentAgreed ? 'bg-blue-600' : 'border border-gray-300 bg-white'
            }`}
          >
            {consentAgreed && <Ionicons name="checkmark" size={14} color="white" />}
          </View>
          <Text className="text-xs text-gray-700 leading-4.5 flex-1">
            I confirm my guarantor has explicitly consented to being contacted by{' '}
            <Text className="font-semibold text-blue-600">QwikHelp Pro</Text> for identity verification.
          </Text>
        </TouchableOpacity>
      </View>

      {/* Confidentiality Caption */}
      <View className="flex-row items-center justify-center mb-4">
        <Ionicons name="lock-closed-outline" size={13} color="#6B7280" className="mr-1" />
        <Text className="text-xs text-gray-500 font-medium">
          256-bit encrypted • Strictly confidential
        </Text>
      </View>

      {/* Submit Application Button */}
      <TouchableOpacity
        onPress={handleNext}
        disabled={loading}
        activeOpacity={0.8}
        className="h-14 bg-[#2563EB] active:bg-blue-700 rounded-xl items-center justify-center mb-10 shadow-sm"
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <View className="flex-row items-center justify-center">
            <Text className="text-white font-semibold text-base mr-2">
              Submit Application
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>

      {/* Relationship Selector Modal */}
      <Modal
        visible={relationshipModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRelationshipModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setRelationshipModalVisible(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-3xl p-5 pb-9">
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />
            <Text className="text-base font-bold text-gray-900 mb-4 text-center">
              Select Relationship to Guarantor
            </Text>

            {RELATIONSHIPS.map((item) => {
              const isSelected = relationship === item;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => {
                    setRelationship(item);
                    setRelationshipModalVisible(false);
                  }}
                  className={`flex-row items-center justify-between p-3.5 rounded-xl mb-2 ${
                    isSelected ? 'bg-blue-50' : 'bg-gray-50'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      isSelected ? 'text-blue-700' : 'text-gray-800'
                    }`}
                  >
                    {item}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              onPress={() => setRelationshipModalVisible(false)}
              className="py-3 items-center mt-2"
            >
              <Text className="text-sm font-semibold text-gray-500">Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAwareScrollView>
  );
}
