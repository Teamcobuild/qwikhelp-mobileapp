import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  initialDate?: Date;
}

export const DatePickerModal = ({ visible, onClose, onConfirm, initialDate }: DatePickerModalProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(initialDate || new Date());

  useEffect(() => {
    if (visible) {
      const init = initialDate || new Date();
      setSelectedDate(init);
      setCurrentMonth(init);
    }
  }, [visible, initialDate]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(year, month, day);
    setSelectedDate(newDate);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to midnight for comparison

  const renderDays = () => {
    const days = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Weekday headers
    const headers = weekDays.map((day, idx) => (
      <View key={`header-${idx}`} className="w-[14%] items-center mb-2">
        <Text className="text-gray-400 text-xs font-bold">{day}</Text>
      </View>
    ));

    const grid = [];
    // Empty slots before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      grid.push(<View key={`empty-${i}`} className="w-[14%] aspect-square items-center justify-center m-0.5" />);
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateOfCell = new Date(year, month, i);
      dateOfCell.setHours(0, 0, 0, 0);

      const isPast = dateOfCell.getTime() < today.getTime();
      const isSelected = selectedDate.getDate() === i && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
      const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();

      grid.push(
        <TouchableOpacity
          key={`day-${i}`}
          onPress={() => !isPast && handleDateSelect(i)}
          disabled={isPast}
          className={`w-[13%] aspect-square items-center justify-center rounded-full m-[0.5%] ${isSelected ? 'bg-green-600' : isToday && !isPast ? 'bg-blue-50' : ''
            }`}
        >
          <Text
            className={`text-sm ${isPast ? 'text-gray-300' : isSelected ? 'text-white font-bold' : isToday ? 'text-blue-600 font-bold' : 'text-gray-700'
              }`}
          >
            {i}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View>
        <View className="flex-row w-full justify-between">{headers}</View>
        <View className="flex-row flex-wrap w-full justify-start">{grid}</View>
      </View>
    );
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View className="flex-row justify-between items-center w-full mb-6">
            <Text className="font-bold text-lg flex-1 text-center ml-6">Select Date</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-between items-center w-full px-2 mb-4">
            <TouchableOpacity onPress={handlePrevMonth} className="p-2">
              <Ionicons name="chevron-back" size={24} color="#374151" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-gray-900">
              {monthNames[month]} {year}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} className="p-2">
              <Ionicons name="chevron-forward" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <View className="w-full mb-6">
            {renderDays()}
          </View>

          <TouchableOpacity
            onPress={() => onConfirm(selectedDate)}
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
