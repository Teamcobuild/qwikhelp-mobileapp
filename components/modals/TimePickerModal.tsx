import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (time: Date) => void;
  initialTime?: Date;
}

export const TimePickerModal = ({ visible, onClose, onConfirm, initialTime }: TimePickerModalProps) => {
  const [selectedTime, setSelectedTime] = useState<Date>(initialTime || new Date());

  useEffect(() => {
    if (visible && initialTime) {
      setSelectedTime(initialTime);
    } else if (visible && !initialTime) {
      // Default to nearest next 30 min slot if not provided
      const now = new Date();
      now.setMinutes(now.getMinutes() > 30 ? 60 : 30);
      now.setSeconds(0);
      now.setMilliseconds(0);
      setSelectedTime(now);
    }
  }, [visible, initialTime]);

  const generateTimeSlots = () => {
    const slots = [];
    // From 8:00 AM to 8:00 PM
    for (let hour = 8; hour <= 20; hour++) {
      for (let min of [0, 30]) {
        const slot = new Date();
        slot.setHours(hour, min, 0, 0);
        slots.push(slot);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View className="flex-row justify-between items-center w-full mb-4">
            <Text className="font-bold text-lg flex-1 text-center ml-6">Select Time</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView className="w-full max-h-72 mb-6" showsVerticalScrollIndicator={false}>
            <View className="flex-row flex-wrap justify-between">
              {timeSlots.map((slot, index) => {
                const isSelected = selectedTime.getHours() === slot.getHours() && selectedTime.getMinutes() === slot.getMinutes();
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedTime(slot)}
                    className={`w-[48%] py-3 mb-3 rounded-xl items-center border ${isSelected ? 'bg-green-600 border-green-600' : 'bg-white border-gray-200'
                      }`}
                  >
                    <Text className={`font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                      {formatTime(slot)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <TouchableOpacity
            onPress={() => onConfirm(selectedTime)}
            className="w-full bg-blue-600 py-3.5 rounded-xl items-center shadow-sm"
          >
            <Text className="text-white font-bold text-base">Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  }
});
