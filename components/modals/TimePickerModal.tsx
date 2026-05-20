import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (time: Date) => void;
  initialTime?: Date;
}

export const TimePickerModal = ({ visible, onClose, onConfirm, initialTime }: TimePickerModalProps) => {
  const [time, setTime] = useState(initialTime || new Date());

  useEffect(() => {
    if (visible && initialTime) {
      setTime(initialTime);
    } else if (visible && !initialTime) {
      setTime(new Date());
    }
  }, [visible, initialTime]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View className="flex-row justify-between items-center w-full mb-4">
            <Text className="font-bold text-lg flex-1 text-center ml-6">Pick a Time</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>
          
          <View className="w-full justify-center items-center mb-6 h-48">
             <DateTimePicker
               value={time}
               mode="time"
               display="spinner"
               onChange={(event, selectedTime) => {
                 if (selectedTime) setTime(selectedTime);
               }}
               style={{ width: '100%', height: '100%' }}
               textColor="#2563eb" // Blue text color
             />
          </View>

          <TouchableOpacity 
            onPress={() => onConfirm(time)}
            className="w-full bg-blue-600 py-4 rounded-xl items-center"
          >
            <Text className="text-white font-bold">Confirm</Text>
          </TouchableOpacity>
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
