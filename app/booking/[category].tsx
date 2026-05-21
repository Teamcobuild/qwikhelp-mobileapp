import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatePickerModal } from '../../components/modals/DatePickerModal';
import { SuccessBookingModal } from '../../components/modals/SuccessBookingModal';
import { TimePickerModal } from '../../components/modals/TimePickerModal';
import { useLocation } from '../../context/LocationContext';

const CATEGORY_CONFIG: Record<string, { subCategories: string[], minFare: number }> = {
  cooking: { subCategories: ['Local Meals', 'Foreign Meals', 'Other'], minFare: 6000 },
  cleaning: { subCategories: ['Deep Clean', 'Standard Clean', 'Other'], minFare: 5000 },
  laundry: { subCategories: ['Wash & Fold', 'Ironing', 'Dry Cleaning'], minFare: 3000 },
  companion: { subCategories: ['Events', 'Casual Hangout', 'Other'], minFare: 8000 },
  'tour guide': { subCategories: ['City Tour', 'Historical', 'Adventure'], minFare: 10000 },
  plumber: { subCategories: ['Pipe Leak', 'Installation', 'Other'], minFare: 7000 },
  electrician: { subCategories: ['Wiring', 'Appliance Repair', 'Other'], minFare: 7000 },
  gardeners: { subCategories: ['Trimming', 'Planting', 'Maintenance'], minFare: 5000 },
};

const DURATIONS = ['2 Hours', '4 Hours', '6 Hours', '8 Hours'];

export default function BookingScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const { locationName } = useLocation();

  // Normalize category string for lookup
  const normalizedCategory = category ? category.toLowerCase() : 'cooking';
  const config = CATEGORY_CONFIG[normalizedCategory] || CATEGORY_CONFIG['cooking'];

  const [subCategory, setSubCategory] = useState<string>('');
  const [dateObj, setDateObj] = useState<Date | undefined>(undefined);
  const [timeObj, setTimeObj] = useState<Date | undefined>(undefined);
  const dateStr = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const timeStr = timeObj ? timeObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  const [duration, setDuration] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [location, setLocation] = useState<string>('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (locationName) {
      setLocation(locationName);
    }
  }, [locationName]);

  const isFormValid = subCategory && dateObj && timeObj && duration && description && amount && location;

  const handleSendOffer = () => {
    if (!isFormValid) return;
    setShowSuccessModal(true);
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            {capitalize(category || 'Cooking')}
          </Text>
        </View>

        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
          {/* Sub Categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 mt-2">
            {config.subCategories.map((cat) => (
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
              className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
              textAlignVertical="top"
              style={{ minHeight: 100 }}
            />
          </View>

          {/* Amount */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">Amount</Text>
            <View className="relative justify-center">
              <Text className="absolute left-4 top-3 text-gray-900 text-lg font-bold">₦</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="numeric"
                className="border border-gray-200 rounded-xl pl-9 pr-4 py-3 bg-gray-50 text-gray-900 text-lg font-bold"
              />
            </View>
            <Text className="text-xs text-gray-400 mt-2">
              You can change the recommended fare. Min: {config.minFare}
            </Text>
          </View>

          {/* Location */}
          <View className="mb-24">
            <Text className="text-gray-700 font-medium mb-2">Service Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Your address"
              className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
            />
            <Text className="text-xs text-gray-400 mt-2">
              You can change your location
            </Text>
          </View>

        </ScrollView>

        {/* Footer */}
        <View className="absolute bottom-0 left-0 right-0 p-6">
          <TouchableOpacity
            onPress={handleSendOffer}
            disabled={!isFormValid}
            className={`py-4 rounded-xl items-center ${isFormValid ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <Text className="text-white font-bold text-lg">Send Offer</Text>
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
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        jobData={{
          category: Array.isArray(category) ? category[0] : category || 'Service',
          duration,
          date: dateStr,
          time: timeStr,
          amount
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  }
});
