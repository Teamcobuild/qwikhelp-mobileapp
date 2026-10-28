import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatePickerModal } from '../../components/modals/DatePickerModal';
import { SuccessBookingModal } from '../../components/modals/SuccessBookingModal';
import { TimePickerModal } from '../../components/modals/TimePickerModal';
import { SERVICES, serviceBySlug } from '../../constants/services';
import { useLocation } from '../../context/LocationContext';
import { errorMessage, formatNaira, uploadJobPhoto } from '../../lib/broadcast';
import { alertService } from '../../lib/AlertService';
import { useSupabase } from '../../lib/supabase';

const DURATIONS = ['2 Hours', '4 Hours', '6 Hours', '8 Hours'];
const MAX_PHOTOS = 4;

export default function BookingScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabase();
  const { locationName, getPreciseCoords } = useLocation();

  const service = serviceBySlug(category) || SERVICES[0];
  const [minFare, setMinFare] = useState<number>(service.minFare);

  const [subCategory, setSubCategory] = useState<string>('');
  const [dateObj, setDateObj] = useState<Date | undefined>(undefined);
  const [timeObj, setTimeObj] = useState<Date | undefined>(undefined);
  const dateStr = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const timeStr = timeObj ? timeObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  const [duration, setDuration] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [landmark, setLandmark] = useState<string>('');
  const [address, setAddress] = useState<string>('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdJob, setCreatedJob] = useState<{ jobId: string; dispatched: number } | null>(null);

  // The database owns minimum fares so they can be tuned without an app release.
  useEffect(() => {
    supabase
      .from('service_categories')
      .select('min_fare')
      .eq('id', service.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.min_fare) setMinFare(data.min_fare);
      });
  }, [supabase, service.id]);

  const amountValue = parseInt(amount.replace(/\D/g, ''), 10) || 0;
  const isFormValid =
    subCategory && dateObj && timeObj && duration && description.trim() && amountValue && landmark.trim() && address.trim();

  const handleAddPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return alertService.alert('Permission Needed', 'Allow photo access so providers can see the problem.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
    }
  };

  const handleSendOffer = async () => {
    if (!isFormValid || !dateObj || !timeObj || !user) return;
    if (amountValue < minFare) {
      return alertService.alert('Amount Too Low', `The minimum fare for ${service.name} is ${formatNaira(minFare)}.`);
    }

    const scheduledAt = new Date(dateObj);
    scheduledAt.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
    if (scheduledAt.getTime() < Date.now() - 5 * 60 * 1000) {
      return alertService.alert('Pick a Future Time', 'Please choose a date and time that has not passed.');
    }

    setSubmitting(true);
    try {
      const coords = await getPreciseCoords();
      const photoPaths: string[] = [];
      for (const uri of photos) {
        photoPaths.push(await uploadJobPhoto(supabase, user.id, uri));
      }

      const { data, error } = await supabase.rpc('create_job', {
        p_category: service.id,
        p_sub_category: subCategory,
        p_description: description.trim(),
        p_photo_paths: photoPaths,
        p_scheduled_at: scheduledAt.toISOString(),
        p_duration_hours: parseInt(duration, 10),
        p_budget: amountValue,
        p_landmark: landmark.trim(),
        p_address: address.trim(),
        p_lat: coords.latitude,
        p_lng: coords.longitude,
        p_city: locationName?.split(',')[0] ?? null,
      });
      if (error) throw error;

      setCreatedJob({ jobId: data.job_id, dispatched: data.dispatched });
    } catch (err) {
      alertService.alert('Could Not Send Request', errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-6 py-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-100"
          >
            <Ionicons name="arrow-back" size={20} color="black" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-lg font-bold text-gray-900 -ml-8">
            {service.name}
          </Text>
        </View>

        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Sub Categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 mt-2">
            {service.subCategories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSubCategory(cat)}
                className={`px-4 py-2 rounded-md mr-3 ${subCategory === cat ? 'bg-blue-600 border-blue-600' : 'bg-white'
                  }`}
              >
                <Text className={`font-medium ${subCategory === cat ? 'text-white' : 'text-gray-500'}`}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Photos */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-1">Photos (optional)</Text>
            <Text className="text-xs text-gray-400 mb-3">
              Show providers the problem. Photos are screenshot-protected and only visible to matched providers.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.map((uri) => (
                <View key={uri} className="mr-3">
                  <Image source={{ uri }} className="w-20 h-20 rounded-xl bg-gray-200" />
                  <TouchableOpacity
                    onPress={() => setPhotos((prev) => prev.filter((p) => p !== uri))}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-900 items-center justify-center"
                  >
                    <Ionicons name="close" size={14} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <TouchableOpacity
                  onPress={handleAddPhoto}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 bg-white items-center justify-center"
                >
                  <Ionicons name="camera-outline" size={22} color="#9ca3af" />
                  <Text className="text-[10px] text-gray-400 mt-1">Add photo</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Date & Time */}
          <View className="flex-row gap-4 mb-6">
            <View className="flex-1">
              <Text className="text-gray-700 font-medium mb-2">Date</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
              >
                <Text className={dateStr ? "text-gray-900" : "text-gray-400"}>
                  {dateStr || 'Select Date'}
                </Text>
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-gray-700 font-medium mb-2">Time</Text>
              <TouchableOpacity
                onPress={() => setShowTimePicker(true)}
                className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
              >
                <Text className={timeStr ? "text-gray-900" : "text-gray-400"}>
                  {timeStr || 'Select Time'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Duration */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">Duration</Text>
            <View className="flex-row flex-wrap gap-3">
              {DURATIONS.map((dur) => (
                <TouchableOpacity
                  key={dur}
                  onPress={() => setDuration(dur)}
                  className={`px-4 py-2 rounded-md ${duration === dur ? 'bg-blue-600 border-blue-600' : 'bg-white'
                    }`}
                >
                  <Text className={`font-medium ${duration === dur ? 'text-white' : 'text-gray-500'}`}>
                    {dur}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Briefly describe what you want"
              multiline
              numberOfLines={4}
              maxLength={1000}
              className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
              textAlignVertical="top"
              style={{ minHeight: 100 }}
            />
          </View>

          {/* Amount */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">Workmanship Fee</Text>
            <View className="relative justify-center">
              <Text className="absolute left-4 top-3 text-gray-900 text-lg font-bold">₦</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                keyboardType="numeric"
                className="border border-gray-200 rounded-xl pl-9 pr-4 py-3 bg-gray-50 text-gray-900 text-lg font-bold"
              />
            </View>
            <Text className="text-xs text-gray-400 mt-2">
              Labour only. Providers can accept or counter once. Min: {formatNaira(minFare)}
            </Text>
          </View>

          {/* Landmark (public) */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">Nearest Landmark</Text>
            <TextInput
              value={landmark}
              onChangeText={setLandmark}
              placeholder="e.g. Opposite Ariaria Market gate"
              maxLength={120}
              className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
            />
            <Text className="text-xs text-gray-400 mt-2">
              Providers only see this landmark and their distance from you.
            </Text>
          </View>

          {/* Exact address (private) */}
          <View className="mb-24">
            <Text className="text-gray-700 font-medium mb-2">Service Address</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="House number and street"
              className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
            />
            <View className="flex-row items-center mt-2">
              <Ionicons name="lock-closed" size={12} color="#9ca3af" />
              <Text className="text-xs text-gray-400 ml-1">
                Kept private. Only shared with the provider you book.
              </Text>
            </View>
          </View>

        </ScrollView>

        {/* Footer */}
        <View className="absolute bottom-0 left-0 right-0 p-6">
          <TouchableOpacity
            onPress={handleSendOffer}
            disabled={!isFormValid || submitting}
            className={`py-4 rounded-xl items-center ${isFormValid ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Send Offer</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        initialDate={dateObj}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(d) => {
          setDateObj(d);
          setShowDatePicker(false);
        }}
      />

      <TimePickerModal
        visible={showTimePicker}
        initialTime={timeObj}
        onClose={() => setShowTimePicker(false)}
        onConfirm={(t) => {
          setTimeObj(t);
          setShowTimePicker(false);
        }}
      />

      <SuccessBookingModal
        visible={!!createdJob}
        jobId={createdJob?.jobId}
        dispatched={createdJob?.dispatched ?? 0}
        onClose={() => setCreatedJob(null)}
      />
    </SafeAreaView>
  );
}
