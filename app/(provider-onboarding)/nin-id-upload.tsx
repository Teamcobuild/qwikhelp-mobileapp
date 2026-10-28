import { DatePickerModal } from '@/components/modals/DatePickerModal';
import { Typography } from '@/components/ui/Typography';
import { DOC_TYPES } from '@/constants/kyc';
import { dobToIso, useKyc } from '@/context/KycContext';
import { alertService } from '@/lib/AlertService';
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

export default function NinIdUpload() {
  const router = useRouter();
  const { kyc: savedKyc, saveStep, uploadImage } = useKyc();

  const [selectedDocId, setSelectedDocId] = useState<string>(
    savedKyc.idType || 'nin'
  );
  const [documentNumber, setDocumentNumber] = useState<string>(
    savedKyc.documentNumber || savedKyc.ninNumber || ''
  );
  const [dob, setDob] = useState<string>(
    savedKyc.dob || ''
  );
  const [idImageUri, setIdImageUri] = useState<string | null>(
    savedKyc.idImageUri || null
  );
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [dateObj, setDateObj] = useState<Date>(() => {
    return savedKyc.dob ? new Date(dobToIso(savedKyc.dob)) : new Date(1994, 7, 14);
  });
  const [pickerModalVisible, setPickerModalVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const currentDoc = DOC_TYPES.find((d) => d.id === selectedDocId) || DOC_TYPES[0];
  const cleanedDocNum = documentNumber.trim().replace(/\s+/g, '');
  const isDocNumValid = cleanedDocNum.length >= currentDoc.expectedLength;


  const handlePickImage = async (useCamera = false) => {
    setPickerModalVisible(false);
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          return alertService.alert(
            'Permission Denied',
            'Camera permission is required to capture your ID.'
          );
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [16, 10],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          return alertService.alert(
            'Permission Denied',
            'Gallery permission is required to select your ID photo.'
          );
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [16, 10],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIdImageUri(result.assets[0].uri);
      }
    } catch (err: any) {
      alertService.alert('Error', err.message || 'Failed to select image.');
    }
  };

  const handleNext = async () => {
    if (!cleanedDocNum) {
      return alertService.alert(
        'Document Number Required',
        `Please enter your valid ${currentDoc.title} number.`
      );
    }
    if (cleanedDocNum.length < currentDoc.expectedLength) {
      return alertService.alert(
        'Incomplete Number',
        `${currentDoc.title} must be at least ${currentDoc.expectedLength} characters.`
      );
    }
    const cleanDobDigits = dob.replace(/\D/g, '');
    if (cleanDobDigits.length < 8) {
      return alertService.alert(
        'Date of Birth Required',
        'Please enter your full date of birth (DD / MM / YYYY).'
      );
    }
    if ((currentDoc.id === 'nin' || currentDoc.id === 'bvn') && !/^\d{11}$/.test(cleanedDocNum)) {
      return alertService.alert('Invalid Number', `${currentDoc.title} must be exactly 11 digits.`);
    }
    if (!idImageUri) {
      return alertService.alert(
        'Document Photo Required',
        'Please scan or upload a clear photo of the front of your ID card or slip.'
      );
    }

    setLoading(true);
    try {
      const idImagePath = await uploadImage('kyc', idImageUri, 'id-document');
      const ninNumber = currentDoc.id === 'nin' ? cleanedDocNum : savedKyc.ninNumber;

      await saveStep({
        next: 'biometric-check',
        kyc: {
          id_type: currentDoc.id,
          document_number: cleanedDocNum,
          nin: ninNumber ?? null,
          dob: dobToIso(dob),
          id_image_path: idImagePath,
        },
        local: {
          ninNumber,
          documentNumber: cleanedDocNum,
          idType: currentDoc.id,
          dob: dob.trim(),
          idImageUri,
        },
      });

      router.push('/(provider-onboarding)/biometric-check');
    } catch (err: any) {
      alertService.alert('Error', err.message || 'Failed to save identity details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-[#F9FAFB] px-5 pt-4"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title & Subtitle */}
      <View className="mb-4">
        <Typography variant="h1" className="text-2xl font-bold text-gray-900 mb-1.5">
          Identity Verification
        </Typography>
        <Text className="text-sm text-gray-500 leading-5">
          Choose your ID type, enter your details and upload a clear photo of the front of your ID.
        </Text>
      </View>

      {/* Verified via Dojah Trust Card */}
      <View className="bg-[#EEF4FF] rounded-2xl p-3.5 flex-row items-center justify-between mb-5">
        <View className="flex-row items-center flex-1 pr-2">
          <View className="w-9 h-9 rounded-xl bg-white items-center justify-center mr-3 shadow-xs">
            <Ionicons name="shield-checkmark" size={20} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-gray-900">
              Verified via Dojah • ISO/IEC 27001
            </Text>
            <Text className="text-[11px] text-gray-500 mt-0.5">
              Direct automated identity registry match
            </Text>
          </View>
        </View>

      </View>

      {/* Select Document Type */}
      <View className="mb-5">
        <Text className="text-sm font-bold text-gray-900 mb-2.5">
          Select Document Type
        </Text>
        <View className="flex-row gap-2.5 mb-2.5">
          {DOC_TYPES.slice(0, 2).map((item) => {
            const isSelected = selectedDocId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSelectedDocId(item.id)}
                activeOpacity={0.7}
                className={`flex-1 p-3 rounded-xl flex-row items-center justify-between ${isSelected
                  ? 'bg-white'
                  : 'bg-[#F1F5F9]'
                  }`}
              >
                <View className="flex-1 pr-1">
                  <Text
                    className={`text-xs font-bold ${isSelected ? 'text-blue-600' : 'text-gray-900'
                      }`}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text className="text-[11px] text-gray-500 mt-0.5">
                    {item.subtitle}
                  </Text>
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                ) : (
                  <View className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="flex-row gap-2.5">
          {DOC_TYPES.slice(2, 4).map((item) => {
            const isSelected = selectedDocId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSelectedDocId(item.id)}
                activeOpacity={0.7}
                className={`flex-1 p-3 rounded-xl  flex-row items-center justify-between ${isSelected
                  ? 'bg-white '
                  : 'bg-[#F1F5F9] '
                  }`}
              >
                <View className="flex-1 pr-1">
                  <Text
                    className={`text-xs font-bold ${isSelected ? 'text-blue-600' : 'text-gray-900'
                      }`}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text className="text-[11px] text-gray-500 mt-0.5">
                    {item.subtitle}
                  </Text>
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                ) : (
                  <View className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Enter 11-digit NIN or BVN / Document Number */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-bold text-gray-900">
            {selectedDocId === 'nin' || selectedDocId === 'bvn'
              ? 'Enter 11-digit NIN or BVN'
              : currentDoc.label}
          </Text>
          <Text
            className={`text-xs font-semibold ${isDocNumValid ? 'text-blue-600' : 'text-gray-400'
              }`}
          >
            {cleanedDocNum.length}/{currentDoc.expectedLength}
          </Text>
        </View>

        <View className="flex-row items-center bg-white rounded-xl px-3.5 py-3 shadow-2xs">
          <Ionicons name="lock-closed-outline" size={18} color="#6B7280" className="mr-2.5" />
          <TextInput
            className="flex-1 text-base font-semibold text-gray-900 p-0 tracking-wide"
            value={documentNumber}
            onChangeText={setDocumentNumber}
            placeholder={currentDoc.placeholder}
            placeholderTextColor="#9CA3AF"
            keyboardType={
              selectedDocId === 'nin' || selectedDocId === 'bvn'
                ? 'numeric'
                : 'default'
            }
            maxLength={currentDoc.expectedLength}
          />
          {isDocNumValid && (
            <Ionicons name="checkmark-circle" size={20} color="#059669" />
          )}
        </View>
      </View>

      {/* Date of Birth (Cross-Check) */}
      <View className="mb-5">
        <Text className="text-sm font-bold text-gray-900 mb-2">
          Date of Birth (Cross-Check)
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowDatePicker(true)}
          className="flex-row items-center bg-white rounded-xl px-3.5 py-3 shadow-2xs justify-between"
        >
          <View className="flex-row items-center flex-1">
            <Ionicons name="calendar-outline" size={18} color="#6B7280" className="mr-2.5" />
            <Text className="text-base font-medium text-gray-900 tracking-wider">
              {dob || 'DD / MM / YYYY'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <DatePickerModal
        visible={showDatePicker}
        initialDate={dateObj}
        allowPastDates={true}
        maxDate={new Date()}
        title="Date of Birth"
        onClose={() => setShowDatePicker(false)}
        onConfirm={(selectedDate) => {
          setDateObj(selectedDate);
          const day = String(selectedDate.getDate()).padStart(2, '0');
          const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
          const year = selectedDate.getFullYear();
          setDob(`${day} / ${month} / ${year}`);
          setShowDatePicker(false);
        }}
      />

      {/* Upload Government ID (Front) */}
      <View className="mb-5">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-bold text-gray-900">
            Upload Government ID (Front)
          </Text>
          <Text className="text-xs text-gray-400">Plastic Card or Slip</Text>
        </View>

        {idImageUri ? (
          <View className=" bg-blue-50/30 rounded-2xl p-3.5">
            <Image
              source={{ uri: idImageUri }}
              className="w-full h-44 rounded-xl bg-gray-200 mb-3"
              resizeMode="cover"
            />
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <Text className="text-xs font-semibold text-gray-800 ml-1.5">
                  ID photo attached
                </Text>
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setPickerModalVisible(true)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-2xs"
                >
                  <Text className="text-xs font-medium text-gray-700">Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIdImageUri(null)}
                  className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg"
                >
                  <Text className="text-xs font-medium text-red-600">Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setPickerModalVisible(true)}
            activeOpacity={0.7}
            className="border-2 border-dashed border-blue-200 bg-[#F8FAFD] rounded-2xl py-7 px-4 items-center justify-center"
          >
            <View className="w-14 h-14 rounded-full bg-blue-100/70 items-center justify-center mb-2.5">
              <Ionicons name="camera" size={26} color="#2563EB" />
            </View>
            <Text className="text-sm font-semibold text-gray-900 mb-1">
              Tap to scan or upload ID slip or card
            </Text>
            <Text className="text-xs text-gray-400 text-center">
              High resolution color capture • Max 10MB JPG, PNG, PDF
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Capture Guidelines */}
      <View className="bg-[#EEF4FF] rounded-2xl p-3.5 mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-bold text-gray-900">
            Capture Guidelines
          </Text>
          <View className="flex-row items-center gap-1">
            <Ionicons name="shield-checkmark-outline" size={14} color="#059669" />
            <Text className="text-xs font-semibold text-emerald-700">
              Machine Legible
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          {/* Card 1: All 4 corners visible */}
          <View className="flex-1 bg-white rounded-xl p-2 items-center shadow-2xs">
            <Image
              source={require('@/assets/images/id_card_corners.jpg')}
              className="w-full h-24 rounded-lg bg-gray-100 mb-2"
              resizeMode="cover"
            />
            <View className="flex-row items-center gap-1.5 self-start px-0.5">
              <Ionicons name="checkmark-circle" size={15} color="#059669" />
              <Text className="text-[11px] font-semibold text-gray-800">
                All 4 corners visible
              </Text>
            </View>
          </View>

          {/* Card 2: No glare or reflection */}
          <View className="flex-1 bg-white rounded-xl p-2 items-center shadow-2xs">
            <Image
              source={require('@/assets/images/id_scan_noglare.jpg')}
              className="w-full h-24 rounded-lg bg-gray-100 mb-2"
              resizeMode="cover"
            />
            <View className="flex-row items-center gap-1.5 self-start px-0.5">
              <Ionicons name="checkmark-circle" size={15} color="#059669" />
              <Text className="text-[11px] font-semibold text-gray-800">
                No glare or reflection
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Button: Next: Liveness Check */}
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
              Next: Liveness Check
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
              Upload Front of Government ID
            </Text>

            <TouchableOpacity
              onPress={() => handlePickImage(true)}
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
                  Scan physical card or paper slip
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handlePickImage(false)}
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
                  Upload an existing photo from your device
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
    </ScrollView>
  );
}
