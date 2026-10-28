import { Typography } from '@/components/ui/Typography';
import { alertService } from '@/lib/AlertService';
import { useKyc } from '@/context/KycContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface GpsCoords {
  lat: number;
  long: number;
  address: string;
  accuracy: number;
}

export default function BaseTerms() {
  const router = useRouter();
  const { kyc: savedKyc, saveStep, uploadImage } = useKyc();

  const [gpsData, setGpsData] = useState<GpsCoords | null>(() => {
    if (savedKyc.gpsLocation) {
      return {
        lat: savedKyc.gpsLocation.latitude,
        long: savedKyc.gpsLocation.longitude,
        address: savedKyc.gpsLocation.address || savedKyc.baseAddress || '',
        accuracy: 3,
      };
    }
    return null;
  });

  const [workshopPhotoUri, setWorkshopPhotoUri] = useState<string | null>(
    savedKyc.workshopPhotoUri || null
  );
  const [agreeSoleProvider, setAgreeSoleProvider] = useState<boolean>(
    savedKyc.soleProviderAgreed ?? false
  );
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCaptureLocation = async () => {
    setCapturingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alertService.alert(
          'Location Permission Required',
          'Location access is needed to verify your workshop or home base.'
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      let addressStr = `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`;
      try {
        const reverse = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (reverse && reverse.length > 0) {
          const place = reverse[0];
          const cityOrDistrict = place.city || place.subregion || place.name;
          if (cityOrDistrict) {
            addressStr = [cityOrDistrict, place.region].filter(Boolean).join(', ');
          }
        }
      } catch { }

      setGpsData({
        lat: loc.coords.latitude,
        long: loc.coords.longitude,
        address: addressStr,
        accuracy: Math.round(loc.coords.accuracy || 3),
      });
    } catch (err: any) {
      alertService.alert(
        'Location Unavailable',
        err.message || 'Could not read your GPS position. Make sure location is turned on and try again.'
      );
    } finally {
      setCapturingLocation(false);
    }
  };

  const handlePickPhoto = async (useCamera = false) => {
    setPickerModalVisible(false);
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          return alertService.alert('Permission Denied', 'Camera permission is required.');
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [16, 10],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          return alertService.alert('Permission Denied', 'Gallery permission is required.');
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [16, 10],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setWorkshopPhotoUri(result.assets[0].uri);
      }
    } catch (err: any) {
      alertService.alert('Error', err.message || 'Failed to select image.');
    }
  };

  const handleNext = async () => {
    if (!gpsData) {
      return alertService.alert(
        'Coordinates Required',
        'Please capture or verify your physical workshop GPS coordinates.'
      );
    }
    if (!workshopPhotoUri) {
      return alertService.alert(
        'Storefront Photo Required',
        'Please upload an exterior photo of your workshop, storefront, or building.'
      );
    }
    if (!agreeSoleProvider) {
      return alertService.alert(
        'Agreement Required',
        'You must agree to the Sole-Provider terms to continue.'
      );
    }

    setLoading(true);
    try {
      const workshopPhotoPath = await uploadImage('kyc', workshopPhotoUri, 'workshop');
      const city = gpsData.address.split(',')[0].trim();

      await saveStep({
        next: 'guarantor',
        provider: { base_address: gpsData.address, city, base_lat: gpsData.lat, base_lng: gpsData.long },
        kyc: { workshop_photo_path: workshopPhotoPath, sole_provider_agreed: true },
        local: {
          baseAddress: gpsData.address,
          city,
          workshopPhotoUri,
          gpsLocation: { latitude: gpsData.lat, longitude: gpsData.long, address: gpsData.address },
          soleProviderAgreed: true,
        },
      });

      router.push('/(provider-onboarding)/guarantor');
    } catch (err: any) {
      alertService.alert('Error', err.message || 'Failed to save workshop base.');
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
      <View className="mb-5">
        <Typography variant="h1" className="text-2xl font-bold text-gray-900 mb-1.5">
          Workshop / Home Base
        </Typography>
        <Text className="text-sm text-gray-500 leading-5">
          Confirm where you work and add an exterior photo so admins can verify your location.
        </Text>
      </View>

      {/* 1. Physical Coordinates Header */}
      <View className="flex-row items-center justify-between mb-2.5">
        <Text className="text-sm font-bold text-gray-900">
          1. Physical Coordinates
        </Text>
        <View className="flex-row items-center gap-1.5">
          <View className="w-2 h-2 rounded-full bg-emerald-500" />
          <Text className="text-xs font-semibold text-emerald-600">
            Live Sensor
          </Text>
        </View>
      </View>

      {/* Capture GPS Location Card */}
      <TouchableOpacity
        onPress={handleCaptureLocation}
        disabled={capturingLocation}
        activeOpacity={0.7}
        className="bg-white rounded-2xl p-4 flex-row items-center justify-between mb-3"
      >
        <View className="flex-row items-center flex-1 pr-2">
          <View className="w-11 h-11 rounded-xl bg-blue-50 items-center justify-center mr-3">
            {capturingLocation ? (
              <ActivityIndicator color="#2563EB" size="small" />
            ) : (
              <Ionicons name="navigate-outline" size={22} color="#2563EB" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-gray-900">
              Capture current GPS location
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5 leading-4">
              Must be standing at your registered workshop or base
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      {/* GPS Verified Status Card */}
      {gpsData && (
        <View className="bg-[#EDF5FF] rounded-2xl p-3.5 mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text className="text-xs font-bold text-emerald-800 ml-1.5">
                GPS Verified • Accurate to {gpsData.accuracy}m
              </Text>
            </View>
            <View className="bg-white rounded-md px-2 py-0.5">
              <Text className="text-[10px] font-semibold text-gray-600">
                Real-time Fix
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            <Ionicons name="location-outline" size={15} color="#4B5563" />
            <Text className="text-xs font-medium text-gray-700 ml-1.5">
              Lat: {gpsData.lat.toFixed(3)}, Long: {gpsData.long.toFixed(3)} ({gpsData.address})
            </Text>
          </View>
        </View>
      )}

      {/* 2. Workshop / Storefront Proof Header */}
      <View className="flex-row items-center justify-between mb-2.5">
        <Text className="text-sm font-bold text-gray-900">
          2. Workshop / Storefront Proof
        </Text>
        <Text className="text-xs text-gray-400">
          Mandatory Photo
        </Text>
      </View>

      {/* Storefront Upload Card */}
      <View className="bg-white rounded-2xl p-6 items-center justify-center mb-5">
        {workshopPhotoUri ? (
          <View className="w-full">
            <Image
              source={{ uri: workshopPhotoUri }}
              className="w-full h-44 rounded-xl bg-gray-100 mb-3"
              resizeMode="cover"
            />
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text className="text-xs font-semibold text-gray-800 ml-1.5">
                  Exterior photo attached
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
                  onPress={() => setWorkshopPhotoUri(null)}
                  className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg"
                >
                  <Text className="text-xs font-medium text-red-600">Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <>
            <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-3">
              <Ionicons name="business" size={24} color="#2563EB" />
            </View>
            <Text className="text-sm font-bold text-gray-900 mb-1 text-center">
              Upload exterior photo of building/shop
            </Text>
            <Text className="text-xs text-gray-400 text-center px-4 mb-4 leading-4">
              Tap to capture workshop signage or street view (Max 10MB JPG/PNG)
            </Text>
            <TouchableOpacity
              onPress={() => setPickerModalVisible(true)}
              activeOpacity={0.8}
              className="bg-[#EDF5FF] rounded-xl py-2.5 px-4 flex-row items-center gap-2 border border-blue-100"
            >
              <Ionicons name="camera" size={16} color="#2563EB" />
              <Text className="text-xs font-bold text-[#1E40AF]">
                Take or Choose Photo
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 3. Sole-Provider Terms Card */}
      <View className="bg-white rounded-2xl p-4  mb-6">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setAgreeSoleProvider(!agreeSoleProvider)}
          className="flex-row items-start"
        >
          <View
            className={`w-5 h-5 rounded-md items-center justify-center mr-3 mt-0.5 ${agreeSoleProvider ? 'bg-blue-600' : 'border border-gray-300 bg-white'
              }`}
          >
            {agreeSoleProvider && (
              <Ionicons name="checkmark" size={14} color="white" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-gray-900">
              I agree to the Sole-Provider terms.
            </Text>
            <Text className="text-xs text-gray-500 leading-4 mt-1.5">
              I will not send unregistered apprentices or sublet jobs booked on QwikHelp.
            </Text>

            {/* Warning Callout Box */}
            <View className="bg-[#EDF5FF] rounded-xl p-3 mt-3 flex-row items-start border border-blue-100">
              <Ionicons name="warning-outline" size={16} color="#DC2626" className="mr-2 mt-0.5" />
              <Text className="text-xs text-red-600 leading-4 font-medium flex-1">
                Violations result in immediate account termination and forfeiture of escrow payouts.
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Action Button: Next: Guarantor Info */}
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
              Next: Guarantor Info
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
              Upload Workshop / Storefront Photo
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
                  Capture storefront or workshop signage
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
                  Upload an existing exterior image
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
