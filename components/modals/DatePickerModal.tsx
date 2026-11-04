import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CalendarDay,
  compareDays,
  daysInMonth,
  formatDay,
  MONTH_NAMES,
  sameDay,
  todayWat,
  weekdayOf,
  WEEKDAY_SHORT,
  withMonth,
} from '../../lib/dates';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (day: CalendarDay) => void;
  initialDate?: CalendarDay;
  minDate?: CalendarDay; // inclusive; defaults to today
  maxDate?: CalendarDay; // inclusive
  title?: string;
}

// Works in calendar days (Nigerian time), never in Date objects, so no timezone can shift the result.
// The picker body mounts on open, so it always starts from the current props.
export const DatePickerModal = (props: DatePickerModalProps) => (
  <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
    {props.visible && <DatePicker {...props} />}
  </Modal>
);

const DatePicker = ({
  onClose,
  onConfirm,
  initialDate,
  minDate,
  maxDate,
  title = 'Select Date',
}: DatePickerModalProps) => {
  const today = todayWat();
  const min = minDate ?? today;

  const isDisabled = (d: CalendarDay) => compareDays(d, min) < 0 || (!!maxDate && compareDays(d, maxDate) > 0);

  // Start on the initial date if it's still allowed, otherwise the nearest allowed day.
  const startDay = () => {
    const d = initialDate ?? today;
    if (compareDays(d, min) < 0) return min;
    if (maxDate && compareDays(d, maxDate) > 0) return maxDate;
    return d;
  };

  const [selected, setSelected] = useState<CalendarDay>(startDay);
  const [view, setView] = useState({ year: selected.year, month: selected.month });
  const [showYearPicker, setShowYearPicker] = useState(false);

  const monthIndex = (y: number, m: number) => y * 12 + (m - 1);
  const canPrev = monthIndex(view.year, view.month) > monthIndex(min.year, min.month);
  const canNext = !maxDate || monthIndex(view.year, view.month) < monthIndex(maxDate.year, maxDate.month);

  const shiftMonth = (delta: number) => {
    const idx = monthIndex(view.year, view.month) + delta;
    setView({ year: Math.floor(idx / 12), month: (idx % 12) + 1 });
  };

  // Picking a year moves the selection too (same day/month, clamped to the allowed range).
  const pickYear = (year: number) => {
    let d = withMonth(selected, year, selected.month);
    if (compareDays(d, min) < 0) d = min;
    if (maxDate && compareDays(d, maxDate) > 0) d = maxDate;
    setSelected(d);
    setView({ year: d.year, month: d.month });
    setShowYearPicker(false);
  };

  const renderYears = () => {
    const startYear = minDate ? minDate.year : today.year;
    const endYear = maxDate ? maxDate.year : today.year + 5;
    const years: number[] = [];
    for (let y = endYear; y >= startYear; y--) years.push(y);

    return (
      <View className="w-full mb-4">
        <ScrollView style={{ maxHeight: 230 }} className="w-full">
          <View className="flex-row flex-wrap justify-between pr-1">
            {years.map((y) => {
              const isSelected = y === selected.year;
              return (
                <TouchableOpacity
                  key={y}
                  onPress={() => pickYear(y)}
                  className={`w-[23%] py-2.5 rounded-xl items-center justify-center mb-2 ${isSelected ? 'bg-blue-600' : 'bg-gray-100'}`}
                >
                  <Text className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-800'}`}>{y}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderDays = () => {
    const first = weekdayOf({ year: view.year, month: view.month, day: 1 });
    const count = daysInMonth(view.year, view.month);
    const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
    while (cells.length % 7) cells.push(null);

    return (
      <View className="w-full mb-4">
        <View className="flex-row w-full mb-2">
          {WEEKDAY_SHORT.map((d) => (
            <Text key={d} className="flex-1 text-center text-gray-400 text-xs font-bold">{d}</Text>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={row} className="flex-row w-full">
            {cells.slice(row * 7, row * 7 + 7).map((n, i) => {
              if (!n) return <View key={i} className="flex-1 aspect-square" />;
              const d = { year: view.year, month: view.month, day: n };
              const disabled = isDisabled(d);
              const isSelected = sameDay(d, selected);
              const isToday = sameDay(d, today);
              return (
                <TouchableOpacity
                  key={i}
                  disabled={disabled}
                  onPress={() => setSelected(d)}
                  className="flex-1 aspect-square items-center justify-center"
                >
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      isSelected ? 'bg-blue-600' : isToday && !disabled ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        disabled ? 'text-gray-300' : isSelected ? 'text-white font-bold' : isToday ? 'text-blue-600 font-bold' : 'text-gray-800 font-medium'
                      }`}
                    >
                      {n}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View className="flex-row justify-between items-center w-full mb-4">
            <Text className="font-bold text-lg flex-1 text-center ml-6 text-gray-900">{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-between items-center w-full px-1 mb-4">
            <TouchableOpacity onPress={() => shiftMonth(-1)} disabled={!canPrev || showYearPicker} className="p-2 rounded-lg bg-gray-50">
              <Ionicons name="chevron-back" size={20} color={canPrev && !showYearPicker ? '#374151' : '#D1D5DB'} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowYearPicker((v) => !v)}
              activeOpacity={0.7}
              className="flex-row items-center gap-1.5 py-1.5 px-3 bg-gray-100 rounded-xl"
            >
              <Text className="text-base font-bold text-gray-900">
                {MONTH_NAMES[view.month - 1]} {view.year}
              </Text>
              <Ionicons name={showYearPicker ? 'chevron-up' : 'chevron-down'} size={16} color="#4B5563" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => shiftMonth(1)} disabled={!canNext || showYearPicker} className="p-2 rounded-lg bg-gray-50">
              <Ionicons name="chevron-forward" size={20} color={canNext && !showYearPicker ? '#374151' : '#D1D5DB'} />
            </TouchableOpacity>
          </View>

          {showYearPicker ? renderYears() : renderDays()}

          {/* Exactly what will be saved */}
          <Text className="text-sm text-gray-600 mb-4">{formatDay(selected)}</Text>

          <TouchableOpacity
            onPress={() => onConfirm(selected)}
            disabled={isDisabled(selected)}
            className="w-full bg-blue-600 py-3.5 rounded-xl items-center"
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
