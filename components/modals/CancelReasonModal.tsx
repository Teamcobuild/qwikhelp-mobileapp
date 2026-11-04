import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

const REASONS: Record<'customer' | 'provider', string[]> = {
  customer: [
    'My plans changed',
    'I found someone else',
    'The provider asked to cancel',
    'Booked by mistake',
    'The price is too high',
  ],
  provider: [
    'I can no longer make this time',
    'Emergency or illness',
    'The job is outside my skills',
    'The location is too far',
    'The customer asked me to cancel',
  ],
};

interface Props {
  visible: boolean;
  role: 'customer' | 'provider';
  refundNote?: string; // e.g. "Your ₦3,500 will be refunded in full."
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string | null) => void;
}

// "Why are you cancelling?" Picking a reason is optional; "Other" lets them type one.
export function CancelReasonModal(props: Props) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {props.visible && <CancelReasonSheet {...props} />}
    </Modal>
  );
}

function CancelReasonSheet({ role, refundNote, submitting, onClose, onConfirm }: Props) {
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState('');

  const reason = choice === 'Other' ? other.trim() || 'Other' : choice;

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end bg-black/40">
      <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-lg font-bold text-gray-900">Why are you cancelling?</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-gray-500 mb-4">Optional, but it helps us improve QwikHelp.</Text>

        {[...REASONS[role], 'Other'].map((r) => {
          const selected = choice === r;
          return (
            <TouchableOpacity
              key={r}
              onPress={() => setChoice(selected ? null : r)}
              className={`flex-row items-center px-4 py-3 rounded-xl mb-2 border ${selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
            >
              <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? '#2563EB' : '#9CA3AF'} />
              <Text className="ml-3 text-sm text-gray-800">{r}</Text>
            </TouchableOpacity>
          );
        })}

        {choice === 'Other' && (
          <TextInput
            value={other}
            onChangeText={setOther}
            placeholder="Tell us more (optional)"
            placeholderTextColor="#9CA3AF"
            maxLength={300}
            multiline
            className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 mb-2 max-h-24"
          />
        )}

        {!!refundNote && (
          <View className="flex-row items-start bg-green-50 rounded-xl px-3 py-2.5 mt-2">
            <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
            <Text className="text-xs text-green-800 ml-2 flex-1">{refundNote}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => onConfirm(reason)}
          disabled={submitting}
          className="bg-red-600 rounded-xl py-3.5 items-center mt-4"
        >
          {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Cancel booking</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} className="py-3 items-center">
          <Text className="text-gray-600 font-semibold">Keep booking</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
