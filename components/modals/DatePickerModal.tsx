import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  initialDate?: Date;
  allowPastDates?: boolean;
  maxDate?: Date;
  minDate?: Date;
  title?: string;
}

export const DatePickerModal = ({
  visible,
  onClose,
  onConfirm,
  initialDate,
  allowPastDates = false,
  maxDate,
  minDate,
  title = 'Select Date',
}: DatePickerModalProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(initialDate || new Date());
  const [showYearPicker, setShowYearPicker] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      const init = initialDate || new Date();
      setSelectedDate(init);
      setCurrentMonth(init);
      setShowYearPicker(false);
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
  today.setHours(0, 0, 0, 0);

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const renderYears = () => {
    const currentYear = new Date().getFullYear();
    const startYear = minDate ? minDate.getFullYear() : 1940;
    const endYear = maxDate ? maxDate.getFullYear() : currentYear + 5;
    const years = [];
    for (let y = endYear; y >= startYear; y--) {
      years.push(y);
    }

    return (
      <View className="w-full mb-4">
        <Text className="text-xs font-semibold text-gray-500 mb-2 text-center">
          Tap to select year
        </Text>
        <ScrollView
          style={{ maxHeight: 230 }}
          showsVerticalScrollIndicator={true}
          className="w-full"
        >
          <View className="flex-row flex-wrap justify-between pr-1">
            {years.map((y) => {
              const isSelected = y === year;
              return (
                <TouchableOpacity
                  key={y}
                  onPress={() => {
                    setCurrentMonth(new Date(y, month, 1));
                    setShowYearPicker(false);
                  }}
                  className={`w-[23%] py-2.5 rounded-xl items-center justify-center mb-2 ${
                    isSelected ? 'bg-blue-600' : 'bg-gray-100'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      isSelected ? 'text-white font-bold' : 'text-gray-800'
                    }`}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderDays = () => {
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
      grid.push(
        <View
          key={`empty-${i}`}
          className="w-[14%] aspect-square items-center justify-center m-0.5"
        />
      );
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateOfCell = new Date(year, month, i);
      dateOfCell.setHours(0, 0, 0, 0);

      const isBeforeMin = minDate ? dateOfCell.getTime() < minDate.getTime() : false;
      const isAfterMax = maxDate ? dateOfCell.getTime() > maxDate.getTime() : false;
      const isPastDisabled = !allowPastDates && dateOfCell.getTime() < today.getTime();
      const isDisabled = isBeforeMin || isAfterMax || isPastDisabled;

      const isSelected =
        selectedDate.getDate() === i &&
        selectedDate.getMonth() === month &&
        selectedDate.getFullYear() === year;
      const isToday =
        i === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear();

      grid.push(
        <TouchableOpacity
          key={`day-${i}`}
          onPress={() => !isDisabled && handleDateSelect(i)}
          disabled={isDisabled}
          className={`w-[13%] aspect-square items-center justify-center rounded-full m-[0.5%] ${
            isSelected
              ? 'bg-blue-600'
              : isToday && !isDisabled
              ? 'bg-blue-50 border border-blue-200'
              : ''
          }`}
        >
          <Text
            className={`text-sm ${
              isDisabled
                ? 'text-gray-300'
                : isSelected
                ? 'text-white font-bold'
                : isToday
                ? 'text-blue-600 font-bold'
                : 'text-gray-800 font-medium'
            }`}
          >
            {i}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View className="w-full mb-6">
        <View className="flex-row w-full justify-between">{headers}</View>
        <View className="flex-row flex-wrap w-full justify-start">{grid}</View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View className="flex-row justify-between items-center w-full mb-4">
            <Text className="font-bold text-lg flex-1 text-center ml-6 text-gray-900">
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Month & Year Navigation */}
          <View className="flex-row justify-between items-center w-full px-1 mb-4">
            <TouchableOpacity onPress={handlePrevMonth} className="p-2 rounded-lg bg-gray-50">
              <Ionicons name="chevron-back" size={20} color="#374151" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowYearPicker(!showYearPicker)}
              activeOpacity={0.7}
              className="flex-row items-center gap-1.5 py-1.5 px-3 bg-gray-100 rounded-xl"
            >
              <Text className="text-base font-bold text-gray-900">
                {monthNames[month]} {year}
              </Text>
              <Ionicons
                name={showYearPicker ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#4B5563"
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleNextMonth} className="p-2 rounded-lg bg-gray-50">
              <Ionicons name="chevron-forward" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Content: Days Grid or Year Selector */}
          {showYearPicker ? renderYears() : renderDays()}

          {/* Confirm Button */}
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
});
