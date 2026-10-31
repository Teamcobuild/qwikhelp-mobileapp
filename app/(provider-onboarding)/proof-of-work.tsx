import { Typography } from '@/components/ui/Typography';
import { alertService } from '@/lib/AlertService';
import { useKyc } from '@/context/KycContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

interface WorkPhoto {
  uri: string;
  title: string;
}

const MAX_PHOTOS = 5;
const MIN_PHOTOS = 3;

export default function ProofOfWork() {
  const router = useRouter();
  const { kyc: savedKyc, saveStep, uploadImage } = useKyc();

  const [photos, setPhotos] = useState<WorkPhoto[]>(() => {
    const uris = savedKyc.proofOfWorkUris || [];
    return uris.map((uri, idx) => ({
      uri,
      title: savedKyc.proofOfWorkTitles?.[idx] || `Project #${idx + 1}`,
    }));
  });
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handlePickPhoto = async (useCamera = false) => {
    setPickerModalVisible(false);
    if (photos.length >= MAX_PHOTOS) {
      return alertService.alert('Limit Reached', `You can upload up to ${MAX_PHOTOS} photos.`);
    }

    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          return alertService.alert('Permission Denied', 'Camera access is required to take photos.');
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          return alertService.alert('Permission Denied', 'Gallery access is required to select photos.');
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsMultipleSelection: false,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUri = result.assets[0].uri;
        setPendingUri(newUri);
        setPendingTitle(`Project #${photos.length + 1}`);
        setTitleModalVisible(true);
      }
    } catch (err: any) {
      alertService.alert('Error', err.message || 'Failed to select image.');
    }
  };

  const handleConfirmPhoto = () => {
    if (pendingUri) {
      setPhotos((prev) => [
        ...prev,
        {
          uri: pendingUri,
          title: pendingTitle.trim() || `Project #${prev.length + 1}`,
        },
      ]);
    }
    setPendingUri(null);
    setPendingTitle('');
    setTitleModalVisible(false);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNext = async () => {
    if (photos.length < MIN_PHOTOS) {
      return alertService.alert(
        'Minimum Photos Required',
        `Please upload at least ${MIN_PHOTOS} photos of completed jobs to showcase your craftsmanship.`
      );
    }

    setLoading(true);
    try {
      const paths: string[] = [];
      for (const [idx, photo] of photos.entries()) {
        paths.push(await uploadImage('portfolio', photo.uri, `work-${idx + 1}`));
      }
      await saveStep({
        next: 'base-terms',
        kyc: { proof_of_work_paths: paths, proof_of_work_titles: photos.map((p) => p.title) },
        local: { proofOfWorkUris: photos.map((p) => p.uri), proofOfWorkTitles: photos.map((p) => p.title) },
      });

      router.push('/(provider-onboarding)/base-terms');
    } catch (err: any) {
      alertService.alert('Error', err.message || 'Failed to save proof of work.');
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
          Show your work
        </Typography>
        <Text className="text-sm text-gray-500 leading-5">
          Upload 3-5 clear photos of completed jobs. Show customers the quality of your work.
        </Text>
      </View>

      {/* Progress / Status Pill Bar */}
      <View className="bg-[#EDF5FF] rounded-2xl py-2.5 px-3.5 flex-row items-center justify-between mb-5">
        {/* <View className="bg-[#065F46] rounded-full px-3 py-1 flex-row items-center gap-1.5">
          <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
          <Text className="text-white text-xs font-semibold">
            {photos.length} of {MAX_PHOTOS} photos added
          </Text>
        </View> */}
        <Text className="text-xs text-gray-500 font-medium">
          (Minimum {MIN_PHOTOS} required)
        </Text>
      </View>

      {/* 2-Column Photo Grid */}
      <View className="flex-row flex-wrap justify-between mb-5">
        {/* Add Photo Slot (if under max) */}
        {photos.length < MAX_PHOTOS && (
          <TouchableOpacity
            onPress={() => setPickerModalVisible(true)}
            activeOpacity={0.7}
            className="w-[48%] aspect-square bg-white rounded-2xl p-4 items-center justify-center shadow-2xs mb-3.5 border border-gray-100"
          >
            <View className="w-14 h-14 rounded-full bg-blue-100/70 items-center justify-center mb-2">
              <Ionicons name="camera" size={26} color="#2563EB" />
            </View>
            <Text className="text-sm font-bold text-blue-600 mb-0.5">
              Add Photo
            </Text>
            <Text className="text-[11px] text-gray-400 text-center">
              JPG or PNG up to 10MB
            </Text>
          </TouchableOpacity>
        )}

        {/* Uploaded Photos */}
        {photos.map((item, index) => (
          <View
            key={index}
            className="w-[48%] aspect-square rounded-2xl overflow-hidden relative shadow-2xs bg-gray-100 mb-3.5"
          >
            <Image
              source={{ uri: item.uri }}
              className="w-full h-full"
              resizeMode="cover"
            />

            {/* Top-Left Verified Checkmark */}
            <View className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-[#059669] items-center justify-center shadow-xs">
              <Ionicons name="checkmark" size={14} color="white" />
            </View>

            {/* Top-Right Remove Button */}
            <TouchableOpacity
              onPress={() => handleRemovePhoto(index)}
              className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white/90 items-center justify-center shadow-xs"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={14} color="#1F2937" />
            </TouchableOpacity>

            {/* Bottom Info Bar with Title & Verified Icon */}
            <View className="absolute inset-x-0 bottom-0 bg-black/50 pt-4 pb-2.5 px-2.5 flex-row items-center justify-between">
              <Text className="text-white font-bold text-xs flex-1 pr-1" numberOfLines={1}>
                {item.title}
              </Text>
              <Ionicons name="checkmark-circle-outline" size={14} color="#34D399" />
            </View>
          </View>
        ))}
      </View>

      {/* Pro Tip Card */}
      <View className="bg-[#EDF5FF] rounded-2xl p-4 flex-row items-start mb-4">
        <View className="w-9 h-9 rounded-full bg-blue-200/60 items-center justify-center mr-3 mt-0.5">
          <Ionicons name="bulb" size={18} color="#2563EB" />
        </View>
        <Text className="text-xs text-gray-700 leading-5 flex-1">
          <Text className="font-bold text-gray-900">Pro Tip:</Text> Well-lit photos of finished projects increase customer bookings by 40%. Avoid blurry or messy construction shots.
        </Text>
      </View>

      {/* Public Profile Caption */}
      <View className="flex-row items-center justify-center mb-6">
        <Ionicons name="lock-closed-outline" size={14} color="#6B7280" className="mr-1.5" />
        <Text className="text-xs text-gray-500 font-medium">
          Portfolio media will be visible on your verified public profile.
        </Text>
      </View>

      {/* Action Button: Next: Location Verification */}
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
              Next: Location Verification
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>

      {/* Image Source Selection Modal */}
      <Modal
        visible={pickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setPickerModalVisible(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-3xl p-5 pb-9">
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />
            <Text className="text-base font-bold text-gray-900 mb-4 text-center">
              Add Proof of Work Photo
            </Text>

            <TouchableOpacity
              onPress={() => handlePickPhoto(true)}
              className="flex-row items-center p-3.5 bg-blue-50/60 rounded-xl mb-3"
            >
              <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                <Ionicons name="camera" size={20} color="#2563EB" />
              </View>
              <View>
                <Text className="text-sm font-semibold text-gray-900">
                  Take Photo (Camera)
                </Text>
                <Text className="text-xs text-gray-500">
                  Snap a photo of your finished work
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handlePickPhoto(false)}
              className="flex-row items-center p-3.5 bg-gray-50 rounded-xl mb-4"
            >
              <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-3">
                <Ionicons name="images" size={20} color="#374151" />
              </View>
              <View>
                <Text className="text-sm font-semibold text-gray-900">
                  Choose from Gallery
                </Text>
                <Text className="text-xs text-gray-500">
                  Upload an existing job photo
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPickerModalVisible(false)}
              className="py-3 items-center"
            >
              <Text className="text-sm font-semibold text-gray-500">Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Project Title / Tag Modal */}
      <Modal
        visible={titleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTitleModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => handleConfirmPhoto()}
          className="flex-1 bg-black/50 justify-center p-5"
        >
          <View
            className="bg-white rounded-3xl p-5"
            onStartShouldSetResponder={() => true}
          >
            <Text className="text-base font-bold text-gray-900 mb-1 text-center">
              Project Title or Tag
            </Text>
            <Text className="text-xs text-gray-500 mb-4 text-center">
              Give this job photo a title customers can recognize.
            </Text>

            <TextInput
              className="bg-gray-100 rounded-xl px-4 py-3 text-base font-medium text-gray-900 mb-4"
              value={pendingTitle}
              onChangeText={setPendingTitle}
              placeholder="e.g. Inverter Setup, Socket Rewire..."
              placeholderTextColor="#9CA3AF"
              maxLength={30}
              autoFocus
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => handleConfirmPhoto()}
                className="flex-1 bg-blue-600 py-3.5 rounded-xl items-center justify-center"
              >
                <Text className="text-white font-bold text-sm">Add to Work</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAwareScrollView>
  );
}
