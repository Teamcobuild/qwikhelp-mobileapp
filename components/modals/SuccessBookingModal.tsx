import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SuccessBookingModalProps {
  visible: boolean;
  onClose: () => void;
  jobId?: string;
  dispatched: number;
}

export const SuccessBookingModal = ({ visible, onClose, jobId, dispatched }: SuccessBookingModalProps) => {
  const router = useRouter();

  const goToOffers = React.useCallback(() => {
    onClose();
    // Replace the form so back doesn't return to a submitted request.
    if (jobId) router.replace({ pathname: '/booking/offers/[jobId]', params: { jobId } });
  }, [jobId, onClose, router]);

  React.useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(goToOffers, 4000);
    return () => clearTimeout(timeout);
  }, [visible, goToOffers]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View className="items-end w-full">
            <TouchableOpacity onPress={goToOffers}>
              <Ionicons name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>
          <View className="items-center py-6">
            <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="checkmark" size={32} color="#16a34a" />
            </View>
            <Text className="font-bold text-xl mb-2 text-center">Offer Sent!</Text>
            <Text className="text-gray-500 text-center mb-8 px-4">
              {dispatched > 0
                ? `We notified ${dispatched} verified provider${dispatched === 1 ? '' : 's'} near you. Offers will appear as they respond.`
                : "We're looking for verified providers near you. Offers will appear here as they respond."}
            </Text>
            <TouchableOpacity
              onPress={goToOffers}
              className="w-full bg-blue-600 py-4 px-6 rounded-xl items-center"
            >
              <Text className="text-white font-bold">View Offers</Text>
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
