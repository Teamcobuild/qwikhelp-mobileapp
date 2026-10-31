import { alertService } from '@/lib/AlertService';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Transaction {
  id: string;
  title: string;
  date: string;
  amount: string;
  type: 'credit' | 'debit';
  status: 'Completed' | 'Processing';
}

const TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    title: 'Payout: Deep Cleaning Service',
    date: 'Today, 11:30 AM',
    amount: '+₦25,000',
    type: 'credit',
    status: 'Completed',
  },
  {
    id: 'tx-2',
    title: 'Bank Withdrawal to Kuda MFB',
    date: 'Yesterday, 4:15 PM',
    amount: '-₦45,000',
    type: 'debit',
    status: 'Completed',
  },
  {
    id: 'tx-3',
    title: 'Payout: Plumbing Repair',
    date: 'Oct 25, 2:00 PM',
    amount: '+₦35,000',
    type: 'credit',
    status: 'Completed',
  },
  {
    id: 'tx-4',
    title: 'Payout: Electrical Troubleshooting',
    date: 'Oct 22, 10:45 AM',
    amount: '+₦85,000',
    type: 'credit',
    status: 'Completed',
  },
];

export default function Earnings() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const handleWithdrawSubmit = () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      alertService.alert('Invalid Amount', 'Please enter a valid withdrawal amount.');
      return;
    }
    setWithdrawModalVisible(false);
    setWithdrawAmount('');
    alertService.alert(
      'Withdrawal Initiated',
      `Your request to withdraw ₦${Number(withdrawAmount).toLocaleString()} has been queued. Funds will arrive in your verified bank account shortly.`
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-3" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between mt-2 mb-4">
          <Text className="text-2xl font-bold text-gray-900">Wallet</Text>
          <TouchableOpacity
            onPress={() => alertService.alert('Payout Settings', 'Bank details: Kuda Bank (•••• 4921)\nAccount Name: Emeka Okonkwo')}
            className="w-10 h-10 rounded-full bg-white items-center justify-center"
          >
            <Ionicons name="card-outline" size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Big Navy Blue Wallet Balance Card */}
        <View
          className="bg-[#0B3356] rounded-[24px] p-5 justify-between mb-5"
        >
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-blue-200 text-xs font-medium">Available Balance</Text>
              <Text className="text-white text-[32px] font-bold tracking-tight mt-1">
                {balanceVisible ? '₦100,000' : '₦••••••••'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setBalanceVisible(!balanceVisible)}
              className="w-9 h-9 rounded-full bg-white/10 items-center justify-center"
            >
              <Ionicons
                name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color="white"
              />
            </TouchableOpacity>
          </View>

          {/* Quick Actions Row */}
          <View className="flex-row items-center gap-3 pt-3 border-t border-white/10">
            <TouchableOpacity
              onPress={() => setWithdrawModalVisible(true)}
              className="flex-1 bg-white py-3 rounded-xl items-center flex-row justify-center"
            >
              <Ionicons name="arrow-up-circle-outline" size={18} color="#0B3356" />
              <Text className="text-[#0B3356] font-bold text-sm ml-2">Withdraw Funds</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => alertService.alert('Bank Account', 'Linked Account: Kuda Bank\nAccount: 2018492019\nName: Emeka Okonkwo')}
              className="bg-white/10 px-4 py-3 rounded-xl items-center justify-center"
            >
              <Text className="text-white font-bold text-sm">Bank Info</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Monthly Summary Stats */}
        <View className="flex-row justify-between mb-6">
          <View
            className="w-[48%] bg-white rounded-2xl p-4"
          >
            <Text className="text-xs text-gray-500 font-medium">This Month</Text>
            <Text className="text-lg font-bold text-emerald-600 mt-1">+₦145,000</Text>
            <Text className="text-[11px] text-gray-400 mt-0.5">14 Completed jobs</Text>
          </View>

          <View
            className="w-[48%] bg-white rounded-2xl p-4"
          >
            <Text className="text-xs text-gray-500 font-medium">Pending Clearance</Text>
            <Text className="text-lg font-bold text-amber-600 mt-1">₦25,000</Text>
            <Text className="text-[11px] text-gray-400 mt-0.5">Clears in 24 hrs</Text>
          </View>
        </View>

        {/* Transactions Section */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-gray-900">Recent Transactions</Text>
          <TouchableOpacity onPress={() => alertService.alert('History', 'Showing latest 4 transactions.')}>
            <Text className="text-xs font-bold text-blue-600">See all</Text>
          </TouchableOpacity>
        </View>

        <View className="pb-10">
          {TRANSACTIONS.map((tx) => (
            <View
              key={tx.id}
              className="bg-white rounded-2xl p-4 mb-3 flex-row items-center justify-between"
            >
              <View className="flex-row items-center flex-1 pr-3">
                <View
                  className={`w-11 h-11 rounded-xl items-center justify-center mr-3.5 ${
                    tx.type === 'credit' ? 'bg-emerald-50' : 'bg-rose-50'
                  }`}
                >
                  <Ionicons
                    name={tx.type === 'credit' ? 'arrow-down-outline' : 'arrow-up-outline'}
                    size={20}
                    color={tx.type === 'credit' ? '#059669' : '#E11D48'}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                    {tx.title}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">{tx.date}</Text>
                </View>
              </View>

              <View className="items-end">
                <Text
                  className={`text-sm font-bold ${
                    tx.type === 'credit' ? 'text-emerald-600' : 'text-gray-900'
                  }`}
                >
                  {tx.amount}
                </Text>
                <Text className="text-[10px] text-gray-400 mt-0.5">{tx.status}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setWithdrawModalVisible(false)}>
          <View className="flex-1 bg-black/40 justify-end">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-t-3xl p-6 pb-10">
                <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-5" />
                <Text className="text-lg font-bold text-gray-900 mb-1">Withdraw to Bank</Text>
                <Text className="text-xs text-gray-500 mb-4">
                  Funds will be transferred to Kuda MFB (•••• 4921)
                </Text>

                <View className="bg-gray-50 rounded-2xl p-4 mb-4">
                  <Text className="text-xs text-gray-500 font-medium">Enter Amount (₦)</Text>
                  <TextInput
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                    placeholder="e.g. 50000"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    className="text-xl font-bold text-gray-900 mt-2 p-0"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleWithdrawSubmit}
                  className="bg-blue-600 py-4 rounded-xl items-center mb-2"
                >
                  <Text className="text-white font-bold text-sm">Confirm Withdrawal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setWithdrawModalVisible(false)}
                  className="bg-gray-100 py-3.5 rounded-xl items-center"
                >
                  <Text className="text-gray-700 font-bold text-sm">Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}
