import React, { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { AlertOptions, alertService } from '../../lib/AlertService';

export const CustomAlert = () => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);

  useEffect(() => {
    alertService.setAlertCallback((opts) => {
      setOptions(opts);
      setVisible(true);
    });
  }, []);

  if (!visible || !options) return null;

  const handlePress = (onPress?: () => void) => {
    setVisible(false);
    if (onPress) onPress();
  };

  const defaultButtons = [{ text: 'OK', onPress: () => setVisible(false) }];
  const buttons = options.buttons?.length ? options.buttons : defaultButtons;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center px-6">
        <View className="bg-white w-full max-w-sm rounded-3xl p-6 items-center shadow-lg">
          <Text className="text-xl font-bold text-gray-900 mb-2">{options.title}</Text>
          {options.message && (
            <Text className="text-gray-500 text-center text-base mb-6 leading-6">
              {options.message}
            </Text>
          )}

          <View className={`w-full flex-row justify-between gap-3 ${buttons.length > 2 ? 'flex-wrap' : ''}`}>
            {buttons.map((btn, index) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handlePress(btn.onPress)}
                  className={`flex-1 min-w-[40%] py-3.5 rounded-xl items-center ${
                    isDestructive ? 'bg-red-600' : isCancel ? 'bg-gray-100' : 'bg-blue-600'
                  } ${buttons.length > 2 ? 'mb-3' : ''}`}
                >
                  <Text className={`font-bold text-base ${isCancel ? 'text-gray-900' : 'text-white'}`}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};
