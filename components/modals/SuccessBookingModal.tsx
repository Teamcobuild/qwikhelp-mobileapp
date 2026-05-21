import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SuccessBookingModalProps {
  visible: boolean;
  onClose: () => void;
  jobData?: {
    category: string;
    duration: string;
    date: string;
    time: string;
    amount: string;
  };
}

export const SuccessBookingModal = ({ visible, onClose, jobData }: SuccessBookingModalProps) => {
  const router = useRouter();

  const handleClose = () => {
    onClose();
    router.back();
  };

  React.useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (visible) {
      timeout = setTimeout(() => {
        onClose();
        // Replace current screen so back button doesn't come back to success modal
        router.replace({
          pathname: '/booking/offers/mock-job-123',
          params: jobData
        });
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [visible, router, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View className="items-end w-full">
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>
          <View className="items-center py-6">
            <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="checkmark" size={32} color="#16a34a" />
            </View>
            <Text className="font-bold text-xl mb-2 text-center">Offer Sent!</Text>
            <Text className="text-gray-500 text-center mb-8 px-4">
              Please wait for some time so available providers can review and accept your offer.
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              className="w-full bg-blue-600 py-4 px-6 rounded-xl items-center"
            >
              <Text className="text-white font-bold">Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

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
