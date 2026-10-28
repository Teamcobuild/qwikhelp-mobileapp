import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Typography } from '@/components/ui/Typography';
import { alertService } from '@/lib/AlertService';
import { useKyc } from '@/context/KycContext';

export default function BiometricCheck() {
  const router = useRouter();
  const { kyc: savedKyc, saveStep, uploadImage } = useKyc();

  const [selfieUri, setSelfieUri] = useState<string | null>(savedKyc.selfieUri || null);
  const [loading, setLoading] = useState(false);

  const handleCaptureSelfie = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        return alertService.alert('Camera Permission Required', 'Please enable camera access to take a live selfie.');
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelfieUri(result.assets[0].uri);
      }
    } catch (err: any) {
      alertService.alert('Error', err.message || 'Could not launch camera.');
    }
  };

  const handleNext = async () => {
    if (!selfieUri) {
      return alertService.alert('Selfie Required', 'Please take a clear selfie to complete the biometric check.');
    }

    setLoading(true);
    try {
      // MVP: the selfie is compared with the ID photo during manual review.
      const selfiePath = await uploadImage('kyc', selfieUri, 'selfie');
      await saveStep({
        next: 'proof-of-work',
        kyc: { selfie_path: selfiePath },
        local: { selfieUri },
      });

      router.push('/(provider-onboarding)/proof-of-work');
    } catch (err: any) {
      alertService.alert('Error', err.message || 'Failed to complete biometric check.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#F9FAFB] px-5 pt-4" showsVerticalScrollIndicator={false}>
      <View className="mb-6">
        <Typography variant="h1" className="text-gray-900 font-bold mb-1">
          Biometric Verification
        </Typography>
        <Typography variant="body" className="text-gray-500 text-sm">
          Take a live selfie to confirm that your face matches the photo on your government ID.
        </Typography>
      </View>

      {/* Selfie Viewfinder / Frame */}
      <View className="items-center justify-center my-6">
        <View className="relative">
          <View
            className={`w-56 h-56 rounded-full border-4 items-center justify-center overflow-hidden bg-gray-50 ${
              selfieUri ? 'border-emerald-500 shadow-md' : 'border-dashed border-blue-400'
            }`}
          >
            {selfieUri ? (
              <Image
                source={{ uri: selfieUri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="items-center px-4">
                <Ionicons name="person-circle-outline" size={88} color="#93C5FD" />
                <Text className="text-xs text-gray-400 text-center mt-1">
                  Position your face inside the circle
                </Text>
              </View>
            )}
          </View>

          {/* Badge */}
          {selfieUri && (
            <View className="absolute bottom-1 right-3 bg-emerald-500 rounded-full p-2 border-2 border-white shadow-sm">
              <Ionicons name="checkmark" size={18} color="white" />
            </View>
          )}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleCaptureSelfie}
          className="mt-6 flex-row items-center px-5 py-2.5 bg-blue-50 border border-blue-200 rounded-full"
        >
          <Ionicons name="camera" size={18} color="#2563EB" />
          <Text className="text-sm font-semibold text-blue-700 ml-2">
            {selfieUri ? 'Retake Selfie' : 'Open Camera & Take Selfie'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Guidelines */}
      <View className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-8">
        <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
          For Best Results
        </Text>
        <View className="gap-2">
          <View className="flex-row items-center">
            <Ionicons name="sunny-outline" size={16} color="#4B5563" />
            <Text className="text-xs text-gray-600 ml-2">
              Stand in a well-lit area with even lighting
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="glasses-outline" size={16} color="#4B5563" />
            <Text className="text-xs text-gray-600 ml-2">
              Remove sunglasses, hats, or face masks
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="scan-outline" size={16} color="#4B5563" />
            <Text className="text-xs text-gray-600 ml-2">
              Look straight ahead with a neutral facial expression
            </Text>
          </View>
        </View>
      </View>

      <Button
        title="Continue to Proof of Work"
        onPress={handleNext}
        loading={loading}
        className="bg-blue-600 mb-12 shadow-sm"
      />
    </ScrollView>
  );
}
