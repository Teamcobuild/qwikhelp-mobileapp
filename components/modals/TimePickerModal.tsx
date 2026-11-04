import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BOOKING, bookingSlots, CalendarDay, formatDay } from '../../lib/dates';

interface TimePickerModalProps {
  visible: boolean;
  day: CalendarDay; // slots are generated for this day (Nigerian time)
  onClose: () => void;
  onConfirm: (at: Date) => void;
  initialTime?: Date;
}

// The slot list mounts on open, so availability is computed against the current time.
export const TimePickerModal = (props: TimePickerModalProps) => (
  <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
    {props.visible && <TimePicker {...props} />}
  </Modal>
);

const TimePicker = ({ day, onClose, onConfirm, initialTime }: TimePickerModalProps) => {
  const [slots] = useState(() => bookingSlots(day));
  // Re-select the previous choice only if it is still a bookable slot on this day.
  const [selected, setSelected] = useState<number | null>(() => {
    const match = initialTime && slots.find((s) => s.available && s.at.getTime() === initialTime.getTime());
    return match ? match.at.getTime() : null;
  });

  const anyAvailable = slots.some((s) => s.available);

  return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View className="flex-row justify-between items-center w-full mb-1">
            <Text className="font-bold text-lg flex-1 text-center ml-6 text-gray-900">Select Time</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <Text className="text-xs text-gray-500 mb-4">{formatDay(day)}</Text>

          {anyAvailable ? (
            <ScrollView className="w-full max-h-72 mb-4" showsVerticalScrollIndicator={false}>
              <View className="flex-row flex-wrap justify-between">
                {slots.map((slot) => {
                  const t = slot.at.getTime();
                  const isSelected = selected === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      disabled={!slot.available}
                      onPress={() => setSelected(t)}
                      className={`w-[48%] py-3 mb-3 rounded-xl items-center border ${
                        isSelected ? 'bg-blue-600 border-blue-600' : slot.available ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <Text className={`font-medium ${isSelected ? 'text-white' : slot.available ? 'text-gray-700' : 'text-gray-300'}`}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <View className="items-center py-6 mb-4">
              <Ionicons name="time-outline" size={28} color="#9CA3AF" />
              <Text className="text-sm text-gray-600 text-center mt-2">
                No times left on this day. Please pick another date.
              </Text>
            </View>
          )}

          <Text className="text-[11px] text-gray-400 mb-3 text-center">
            Times are Nigerian time (WAT). Bookings need at least {BOOKING.leadMinutes} minutes&apos; notice.
          </Text>

          <TouchableOpacity
            onPress={() => selected !== null && onConfirm(new Date(selected))}
            disabled={selected === null}
            className={`w-full py-3.5 rounded-xl items-center ${selected === null ? 'bg-gray-300' : 'bg-blue-600'}`}
          >
            <Text className="text-white font-bold text-base">Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
});
