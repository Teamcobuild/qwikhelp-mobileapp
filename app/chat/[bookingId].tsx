import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { PROVIDERS } from '../../constants/providers';

export default function ChatScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  
  const provider = PROVIDERS[bookingId || '1'] || PROVIDERS['1'];

  const [message, setMessage] = useState('');
  
  // Mock conversation
  const [messages, setMessages] = useState([
    { id: 1, sender: 'user', text: 'Hello, where are you at ?', time: '10:15 am', read: true },
    { id: 2, sender: 'provider', text: 'Am on the way I will be there in a short time', time: '10:16 am', read: false },
    { id: 3, sender: 'user', text: 'Okay I am waiting', time: '10:17 am', read: true },
  ]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm z-10">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-1">
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-row items-center"
              onPress={() => router.push(`/provider-profile/${bookingId || '1'}`)}
            >
              <Image source={{ uri: provider.image }} className="w-10 h-10 rounded-full mr-3" />
              
              <View>
                <Text className="text-gray-900 font-bold text-base">{provider.name}</Text>
                <Text className="text-blue-600 text-xs font-medium">Online</Text>
              </View>
            </TouchableOpacity>
          </View>
          
          <View className="flex-row items-center gap-4">
            <TouchableOpacity>
              <Ionicons name="call-outline" size={22} color="#4b5563" />
            </TouchableOpacity>
            <TouchableOpacity>
              <Ionicons name="videocam-outline" size={24} color="#4b5563" />
            </TouchableOpacity>
            <TouchableOpacity>
              <Ionicons name="ellipsis-vertical" size={20} color="#4b5563" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Chat Area */}
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Date Separator */}
          <View className="flex-row items-center justify-center my-6">
            <Text className="text-gray-400 text-xs font-medium">Today</Text>
            <View className="w-[1px] h-3 bg-gray-300 mx-2" />
            <Text className="text-gray-400 text-xs font-medium">10:15 AM</Text>
          </View>

          {/* Messages */}
          {messages.map((msg) => (
            <View key={msg.id} className={`mb-4 max-w-[80%] ${msg.sender === 'user' ? 'self-end' : 'self-start'}`}>
              <View 
                className={`px-4 py-3 rounded-2xl ${
                  msg.sender === 'user' 
                    ? 'bg-blue-600 rounded-tr-sm' 
                    : 'bg-blue-200 rounded-tl-sm'
                }`}
              >
                <Text className={`${msg.sender === 'user' ? 'text-white' : 'text-gray-900'} text-sm leading-5`}>
                  {msg.text}
                </Text>
              </View>
              <View className={`flex-row items-center mt-1 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <Text className="text-blue-500 text-[10px]">{msg.time}</Text>
                {msg.sender === 'user' && (
                  <Ionicons name="checkmark-done" size={14} color="#3b82f6" className="ml-1" />
                )}
              </View>
            </View>
          ))}

          {/* Typing Indicator */}
          <View className="self-start mb-6 mt-2 ml-1">
            <View className="flex-row gap-1">
              <View className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <View className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <View className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            </View>
          </View>
        </ScrollView>

        {/* Input Area */}
        <View className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex-row items-end">
          <View className="flex-1 bg-white rounded-full flex-row items-center px-4 min-h-[50px] shadow-sm shadow-gray-200 border border-gray-100 mr-3">
            <TouchableOpacity className="mr-2">
              <Ionicons name="happy-outline" size={24} color="#9ca3af" />
            </TouchableOpacity>
            
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Message"
              placeholderTextColor="#9ca3af"
              className="flex-1 py-3 text-gray-900 text-sm"
              multiline
              maxLength={500}
            />
            
            <TouchableOpacity className="ml-2">
              <Ionicons name="attach-outline" size={24} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity className="ml-3">
              <Ionicons name="camera-outline" size={24} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            className="w-[50px] h-[50px] rounded-full bg-blue-600 items-center justify-center shadow-sm shadow-blue-200 mb-0.5"
            onPress={() => {
              if (message.trim()) {
                setMessages([...messages, { id: Date.now(), sender: 'user', text: message, time: '10:18 am', read: false }]);
                setMessage('');
              }
            }}
          >
            {message.trim() ? (
              <Ionicons name="send" size={20} color="white" style={{ marginLeft: 4 }} />
            ) : (
              <Ionicons name="mic" size={24} color="white" />
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
