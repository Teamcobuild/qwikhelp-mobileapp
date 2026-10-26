import { alertService } from '@/lib/AlertService';
import { KycData } from '@/types/provider';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface TradeCategory {
  id: string;
  name: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TRADE_CATEGORIES: TradeCategory[] = [
  {
    id: 'electrical',
    name: 'Electrical Repairs',
    subtitle: 'Residential & Commercial installations',
    icon: 'flash',
  },
  {
    id: 'plumbing',
    name: 'Plumbing & Pipefitting',
    subtitle: 'Drainage, leaks, pipe repairs & fittings',
    icon: 'water',
  },
  {
    id: 'cleaning',
    name: 'Deep Cleaning & Janitorial',
    subtitle: 'Homes, offices & post-construction clean',
    icon: 'sparkles',
  },
  // {
  //   id: 'ac_repair',
  //   name: 'AC & Refrigeration',
  //   subtitle: 'Servicing, gas refill & installations',
  //   icon: 'snow',
  // },
  {
    id: 'carpentry',
    name: 'Carpentry & Woodwork',
    subtitle: 'Furniture, roofing, cabinets & framing',
    icon: 'hammer',
  },
  // {
  //   id: 'painting',
  //   name: 'Painting & Decoration',
  //   subtitle: 'Interior, exterior, POP & screeding',
  //   icon: 'color-palette',
  // },
  {
    id: 'cooking',
    name: 'Catering & Cooking',
    subtitle: 'Private chef, meal prep & event catering',
    icon: 'restaurant',
  },
  {
    id: 'laundry',
    name: 'Laundry & Dry Cleaning',
    subtitle: 'Washing, ironing & garment care',
    icon: 'shirt',
  },
  // {
  //   id: 'mechanic',
  //   name: 'Auto Mechanic & Diagnostics',
  //   subtitle: 'Engine, brakes, suspension & electrical',
  //   icon: 'car',
  // },
  // {
  //   id: 'moving',
  //   name: 'Moving & Delivery',
  //   subtitle: 'Relocation, heavy lifting & haulage',
  //   icon: 'cube',
  // },
];

const EXPERIENCE_OPTIONS = ['1-2 yrs', '3-5 yrs', '6+ yrs'];

export default function PersonalDetails() {
  const { user } = useUser();
  const router = useRouter();

  const savedKyc = ((user?.unsafeMetadata as any)?.kycData || {}) as KycData;

  const defaultName =
    savedKyc.legalName ||
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    'Chukwuemeka Victor';

  const defaultPhone =
    savedKyc.phone ||
    user?.primaryPhoneNumber?.phoneNumber?.replace('+234', '') ||
    '0803 492 8812';

  const defaultBio =
    savedKyc.bio ||
    'Over 6 years of certified residential and commercial electrical installation and repairs.';

  const [legalName, setLegalName] = useState<string>(defaultName);
  const [phone, setPhone] = useState<string>(defaultPhone);
  const [selectedTrade, setSelectedTrade] = useState<TradeCategory>(
    TRADE_CATEGORIES.find((t) => t.name === savedKyc.trade) || TRADE_CATEGORIES[0]
  );
  const [yearsExperience, setYearsExperience] = useState<string>(
    savedKyc.yearsExperience || '6+ yrs'
  );
  const [bio, setBio] = useState<string>(defaultBio);
  const [avatarUri, setAvatarUri] = useState<string | null>(
    savedKyc.avatarUri || user?.imageUrl || null
  );
  const [encryptedAgreed, setEncryptedAgreed] = useState<boolean>(true);
  const [tradeModalVisible, setTradeModalVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return alertService.alert('Permission Denied', 'Gallery access is needed to select a profile photo.');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err: any) {
      alertService.alert('Error', err.message || 'Could not pick image.');
    }
  };

  const handleNext = async () => {
    if (!legalName.trim()) {
      return alertService.alert('Name Required', 'Please enter your full legal name as it appears on your ID.');
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10 && phoneDigits.length !== 11) {
      return alertService.alert('Phone Required', 'Phone number must be 10 or 11 digits.');
    }
    if (!bio.trim()) {
      return alertService.alert('Bio Required', 'Please provide a short professional bio.');
    }

    setLoading(true);
    try {
      await user?.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          onboardingStep: 'nin-id-upload',
          kycData: {
            ...savedKyc,
            legalName: legalName.trim(),
            avatarUri: avatarUri || undefined,
            trade: selectedTrade.name,
            tradeSubtitle: selectedTrade.subtitle,
            yearsExperience,
            phone: phone.trim(),
            bio: bio.trim(),
          },
        },
      });

      router.push('/(provider-onboarding)/nin-id-upload');
    } catch (err: any) {
      alertService.alert('Error', err.message || 'Failed to save details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isPhoneValid = phone.replace(/\D/g, '').length === 10 || phone.replace(/\D/g, '').length === 11;

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <ScrollView
        className="flex-1 bg-[#F9FAFB] px-5 pt-2"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Title & Subtitle */}
        <View className="mb-6">
          <Text className="text-[26px] font-bold text-[#0F172A] tracking-tight mb-2">
            Setup Your Profile
          </Text>
          <Text className="text-sm text-gray-500 leading-5">
            Add your details and tell customers what you do. Your legal name must match your government ID.
          </Text>
        </View>

        {/* Profile Avatar Section */}
        <View className="items-center mb-6">
          <View className="relative">
            <View className="w-24 h-24 rounded-full bg-[#1E293B] items-center justify-center overflow-hidden border-2 border-white shadow-sm">
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <View className="w-full h-full bg-[#1E293B] items-center justify-center">
                  <Ionicons name="person" size={54} color="#CBD5E1" />
                </View>
              )}
            </View>

            {/* Camera Badge */}
            <TouchableOpacity
              onPress={handlePickAvatar}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 border-2 border-white items-center justify-center shadow-sm"
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={15} color="white" />
            </TouchableOpacity>
          </View>

          {/* Photo visible notice badge */}
          <View className="mt-3 px-3.5 py-1.5 bg-[#F1F5F9] rounded-full flex-row items-center gap-1.5">
            <Ionicons name="shield-checkmark" size={14} color="#059669" />
            <Text className="text-[11px] font-medium text-slate-600">
              Photo visible after verification
            </Text>
          </View>
        </View>

        {/* Full Legal Name */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-sm font-semibold text-[#1E293B]">
              Full Legal Name
            </Text>
            <View className="bg-[#D1FAE5] px-2 py-0.5 rounded">
              <Text className="text-[11px] font-bold text-[#059669]">Match</Text>
            </View>
          </View>

          <View className="bg-white rounded-2xl px-4 py-3.5 flex-row items-center justify-between shadow-2xs">
            <TextInput
              value={legalName}
              onChangeText={setLegalName}
              placeholder="e.g. Chukwuemeka Victor"
              placeholderTextColor="#94A3B8"
              className="flex-1 text-sm font-semibold text-[#0F172A] p-0"
            />
            {legalName.trim().length > 2 && (
              <Ionicons name="checkmark" size={18} color="#059669" />
            )}
          </View>

          <Text className="text-xs text-gray-400 mt-1.5">
            Must match the legal name on your government-issued ID.
          </Text>
        </View>

        {/* Phone Number */}
        <View className="mb-5">
          <Text className="text-sm font-semibold text-[#1E293B] mb-1.5">
            Phone Number
          </Text>

          <View className="flex-row items-center">
            {/* Country Code Pill */}
            <View className="bg-white rounded-2xl px-3.5 py-3.5 flex-row items-center justify-center mr-3 shadow-2xs">
              <Text className="text-base mr-1.5">🇳🇬</Text>
              <Text className="text-sm font-semibold text-[#0F172A]">+234</Text>
            </View>

            {/* Phone Input Box */}
            <View className="bg-white rounded-2xl px-4 py-3.5 flex-1 flex-row items-center justify-between shadow-2xs">
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="0803 492 8812"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                className="flex-1 text-sm font-semibold text-[#0F172A] p-0 tracking-wider"
              />
              {isPhoneValid && (
                <Ionicons name="checkmark" size={18} color="#059669" />
              )}
            </View>
          </View>
        </View>

        {/* Primary Trade Category */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-sm font-semibold text-[#1E293B]">
              Primary Trade Category
            </Text>
            <Text className="text-xs text-gray-400 font-medium">Required</Text>
          </View>

          <TouchableOpacity
            onPress={() => setTradeModalVisible(true)}
            activeOpacity={0.8}
            className="bg-white rounded-2xl p-3.5 flex-row items-center justify-between shadow-2xs"
          >
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-11 h-11 rounded-xl bg-blue-100/70 items-center justify-center mr-3">
                <Ionicons name={selectedTrade.icon} size={20} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-[#0F172A]">
                  {selectedTrade.name}
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                  {selectedTrade.subtitle}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={20} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* Years of Practical Experience */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-semibold text-[#1E293B]">
              Years of Practical Experience
            </Text>
            <Text className="text-xs font-semibold text-blue-600">
              High Credibility
            </Text>
          </View>

          <View className="flex-row gap-2.5">
            {EXPERIENCE_OPTIONS.map((exp) => {
              const isSelected = yearsExperience === exp;
              return (
                <TouchableOpacity
                  key={exp}
                  onPress={() => setYearsExperience(exp)}
                  activeOpacity={0.8}
                  className={`flex-1 py-3.5 rounded-2xl items-center justify-center ${isSelected ? 'bg-blue-600 shadow-xs' : 'bg-white shadow-2xs'
                    }`}
                >
                  <Text
                    className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-[#334155]'
                      }`}
                  >
                    {exp}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Short Professional Bio */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-sm font-semibold text-[#1E293B]">
              Short Professional Bio
            </Text>
            <Text className="text-xs text-gray-400 font-medium">
              {bio.length}/240
            </Text>
          </View>

          <View className="bg-white rounded-2xl p-4 min-h-[92px] shadow-2xs">
            <TextInput
              value={bio}
              onChangeText={(text) => {
                if (text.length <= 240) setBio(text);
              }}
              placeholder="Over 6 years of certified residential and commercial electrical installation and repairs."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              className="text-sm font-medium text-[#0F172A] leading-5 p-0"
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          <Text className="text-xs text-gray-400 mt-1.5">
            Visible on client booking quotes
          </Text>
        </View>



        {/* Next Button */}
        <TouchableOpacity
          onPress={handleNext}
          disabled={loading}
          activeOpacity={0.85}
          className="h-14 rounded-2xl bg-blue-600 flex-row items-center justify-center shadow-sm mb-8"
        >
          <Text className="text-white font-bold text-base mr-1">
            {loading ? 'Saving Details...' : 'Next: Verify Identity'}
          </Text>
          {!loading && <Ionicons name="chevron-forward" size={18} color="white" />}
        </TouchableOpacity>
      </ScrollView>

      {/* Trade Category Selection Modal */}
      <Modal
        visible={tradeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTradeModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-5 max-h-[75%]">
            <View className="flex-row items-center justify-between pb-3 mb-3">
              <Text className="text-lg font-bold text-[#0F172A]">
                Select Primary Trade
              </Text>
              <TouchableOpacity
                onPress={() => setTradeModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {TRADE_CATEGORIES.map((trade) => {
                const isSelected = selectedTrade.id === trade.id;
                return (
                  <TouchableOpacity
                    key={trade.id}
                    onPress={() => {
                      setSelectedTrade(trade);
                      setTradeModalVisible(false);
                    }}
                    className={`flex-row items-center p-3.5 rounded-2xl mb-2 ${isSelected
                      ? 'bg-blue-50 '
                      : 'bg-[#F8FAFC] border-transparent'
                      }`}
                  >
                    <View
                      className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isSelected ? 'bg-blue-600' : 'bg-blue-100/70'
                        }`}
                    >
                      <Ionicons
                        name={trade.icon}
                        size={18}
                        color={isSelected ? 'white' : '#2563EB'}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-[#0F172A]'
                          }`}
                      >
                        {trade.name}
                      </Text>
                      <Text className="text-xs text-gray-500 mt-0.5">
                        {trade.subtitle}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
