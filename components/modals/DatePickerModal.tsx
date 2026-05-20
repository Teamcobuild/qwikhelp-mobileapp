import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  initialDate?: Date;
}

export const DatePickerModal = ({ visible, onClose, onConfirm, initialDate }: DatePickerModalProps) => {
  const [date, setDate] = useState(initialDate || new Date());

  useEffect(() => {
    if (visible && initialDate) {
      setDate(initialDate);
    } else if (visible && !initialDate) {
      setDate(new Date());
    }
  }, [visible, initialDate]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View className="flex-row justify-between items-center w-full mb-4">
            <Text className="font-bold text-lg flex-1 text-center ml-6">Pick a Date</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>
          
          <View className="w-full justify-center items-center mb-6 h-48">
             <DateTimePicker
               value={date}
               mode="date"
               display="spinner"
               minimumDate={new Date()}
               onChange={(event, selectedDate) => {
                 if (selectedDate) setDate(selectedDate);
               }}
               style={{ width: '100%', height: '100%' }}
               textColor="#2563eb" // Blue text color
             />
          </View>

          <TouchableOpacity 
            onPress={() => onConfirm(date)}
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
