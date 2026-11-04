import { EmptyEarningsArt, EmptyState } from '@/components/illustrations/EmptyStates';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { alertService } from '@/lib/AlertService';
import { errorMessage, formatNaira } from '@/lib/broadcast';
import { formatRelativeShort } from '@/lib/dates';
import { callPayments } from '@/lib/payments';
import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Wallet {
  available: number;
  in_escrow: number;
  total_earned: number;
  commission_rate: number;
  min_withdrawal: number;
  account: { bank_name: string; account_name: string; account_last4: string } | null;
  entries: { id: string; kind: 'earning' | 'withdrawal' | 'withdrawal_reversal'; amount: number; note: string | null; withdrawal_id: string | null; created_at: string }[];
  withdrawals: { id: string; amount: number; fee: number; net_amount: number; status: 'pending' | 'success' | 'failed' | 'reversed'; created_at: string }[];
}

// Paystack transfer fee, deducted from the withdrawal (mirrors private.transfer_fee()).
const transferFee = (amount: number) => (amount <= 5000 ? 10 : amount <= 50000 ? 25 : 50);

export default function WalletScreen() {
  const { user } = useUser();
  const supabase = useSupabase();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [showAccount, setShowAccount] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_wallet');
    if (error) alertService.alert('Error', errorMessage(error));
    else setWallet(data as Wallet);
    setRefreshing(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(user ? `provider-wallet:${user.id}` : null, [
    { table: 'bookings', filter: `provider_id=eq.${user?.id}` },
    { table: 'wallet_entries', filter: `provider_id=eq.${user?.id}` },
    { table: 'withdrawals', filter: `provider_id=eq.${user?.id}` },
  ], load);

  const pendingWithdrawal = wallet?.withdrawals.some((w) => w.status === 'pending');

  const onWithdrawPress = () => {
    if (!wallet) return;
    if (!wallet.account) return setShowAccount(true);
    if (pendingWithdrawal) return alertService.alert('Withdrawal in progress', 'Please wait for your current withdrawal to finish.');
    if (wallet.available < wallet.min_withdrawal) {
      return alertService.alert('Not enough yet', `You can withdraw once you have at least ${formatNaira(wallet.min_withdrawal)}.`);
    }
    setShowWithdraw(true);
  };

  if (!wallet) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center">
        <ActivityIndicator color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
      <ScrollView
        className="flex-1 px-4 pt-3"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text className="text-2xl font-bold text-gray-900 mt-2 mb-4">Wallet</Text>

        {/* Available balance */}
        <View className="bg-[#0B3356] rounded-[24px] p-5 mb-5">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-blue-200 text-xs font-medium">Available to withdraw</Text>
              <Text className="text-white text-[32px] font-bold tracking-tight mt-1">
                {balanceVisible ? formatNaira(wallet.available) : '₦••••••••'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)} className="w-9 h-9 rounded-full bg-white/10 items-center justify-center">
              <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={18} color="white" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onWithdrawPress} className="bg-white py-3 rounded-xl items-center flex-row justify-center">
            <Ionicons name="arrow-up-circle-outline" size={18} color="#0B3356" />
            <Text className="text-[#0B3356] font-bold text-sm ml-2">
              {wallet.account ? (pendingWithdrawal ? 'Withdrawal in progress' : 'Withdraw') : 'Add bank account to withdraw'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View className="flex-row justify-between mb-4">
          <View className="w-[48%] bg-white rounded-2xl p-4">
            <Text className="text-xs text-gray-500 font-medium">Held in escrow</Text>
            <Text className="text-lg font-bold text-amber-600 mt-1">{formatNaira(wallet.in_escrow)}</Text>
            <Text className="text-[11px] text-gray-400 mt-0.5">Released when jobs are confirmed</Text>
          </View>
          <View className="w-[48%] bg-white rounded-2xl p-4">
            <Text className="text-xs text-gray-500 font-medium">Total earned</Text>
            <Text className="text-lg font-bold text-emerald-600 mt-1">{formatNaira(wallet.total_earned)}</Text>
            <Text className="text-[11px] text-gray-400 mt-0.5">After {wallet.commission_rate}% QwikHelp fee</Text>
          </View>
        </View>

        {/* Payout account */}
        <TouchableOpacity onPress={() => setShowAccount(true)} className="bg-white rounded-2xl p-4 mb-6 flex-row items-center">
          <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-3">
            <Ionicons name="business-outline" size={20} color="#2563EB" />
          </View>
          <View className="flex-1">
            {wallet.account ? (
              <>
                <Text className="text-sm font-bold text-gray-900">{wallet.account.bank_name} ••{wallet.account.account_last4}</Text>
                <Text className="text-xs text-gray-500">{wallet.account.account_name}</Text>
              </>
            ) : (
              <>
                <Text className="text-sm font-bold text-gray-900">Add payout account</Text>
                <Text className="text-xs text-gray-500">Where we send your withdrawals</Text>
              </>
            )}
          </View>
          <Text className="text-blue-600 text-xs font-bold">{wallet.account ? 'Change' : 'Add'}</Text>
        </TouchableOpacity>

        <Text className="text-base font-bold text-gray-900 mb-3">Transactions</Text>
        <View className="pb-10">
          {wallet.entries.length === 0 ? (
            <View className="bg-white rounded-2xl py-6">
              <EmptyState
                art={<EmptyEarningsArt width={180} />}
                title="No earnings yet"
                message="When a customer confirms a job, your share lands here."
              />
            </View>
          ) : (
            wallet.entries.map((e) => <EntryRow key={e.id} entry={e} wallet={wallet} />)
          )}
        </View>
      </ScrollView>

      <AccountModal visible={showAccount} onClose={() => setShowAccount(false)} onSaved={() => { setShowAccount(false); load(); }} />
      <WithdrawModal
        visible={showWithdraw}
        wallet={wallet}
        onClose={() => setShowWithdraw(false)}
        onDone={() => { setShowWithdraw(false); load(); }}
      />
    </SafeAreaView>
  );
}

function EntryRow({ entry: e, wallet }: { entry: Wallet['entries'][number]; wallet: Wallet }) {
  const credit = e.amount > 0;
  const withdrawal = e.withdrawal_id ? wallet.withdrawals.find((w) => w.id === e.withdrawal_id) : undefined;
  const status = e.kind === 'withdrawal' ? withdrawal?.status : undefined;
  const icon = e.kind === 'earning' ? 'briefcase-outline' : e.kind === 'withdrawal' ? 'arrow-up-outline' : 'arrow-undo-outline';
  return (
    <View className="bg-white rounded-2xl p-4 mb-3 flex-row items-center">
      <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${credit ? 'bg-emerald-50' : 'bg-gray-100'}`}>
        <Ionicons name={icon} size={18} color={credit ? '#059669' : '#4B5563'} />
      </View>
      <View className="flex-1 pr-2">
        <Text className="text-sm font-bold text-gray-900" numberOfLines={2}>{e.note ?? e.kind}</Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {formatRelativeShort(e.created_at)}
          {status === 'pending' ? ' • Processing' : status === 'success' ? ' • Sent' : ''}
        </Text>
      </View>
      <Text className={`text-sm font-bold ${credit ? 'text-emerald-600' : 'text-gray-900'}`}>
        {credit ? '+' : '-'}{formatNaira(Math.abs(e.amount))}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Payout account: pick a bank, enter the account number, Paystack confirms the name.
function AccountModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {visible && <AccountSheet onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function AccountSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = useSupabase();
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bank, setBank] = useState<{ name: string; code: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    callPayments<{ banks: { name: string; code: string }[] }>(supabase, 'banks')
      .then((r) => setBanks(r.banks))
      .catch((err) => alertService.alert('Error', errorMessage(err)));
  }, [supabase]);

  // Look the name up as soon as we have a bank and 10 digits.
  useEffect(() => {
    setAccountName(null);
    if (!bank || accountNumber.length !== 10) return;
    let cancelled = false;
    setResolving(true);
    callPayments<{ account_name: string }>(supabase, 'resolve', { account_number: accountNumber, bank_code: bank.code })
      .then((r) => !cancelled && setAccountName(r.account_name))
      .catch((err) => !cancelled && alertService.alert('Account not found', errorMessage(err)))
      .finally(() => !cancelled && setResolving(false));
    return () => {
      cancelled = true;
    };
  }, [supabase, bank, accountNumber]);

  const filtered = useMemo(() => banks.filter((b) => b.name.toLowerCase().includes(search.toLowerCase())), [banks, search]);

  const save = async () => {
    if (!bank || !accountName) return;
    setSaving(true);
    try {
      await callPayments(supabase, 'save_account', { account_number: accountNumber, bank_code: bank.code });
      onSaved();
    } catch (err) {
      alertService.alert('Could not save account', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end bg-black/40">
      <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8" style={{ maxHeight: '90%' }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-gray-900">{picking ? 'Choose your bank' : 'Payout account'}</Text>
          <TouchableOpacity onPress={picking ? () => setPicking(false) : onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={picking ? 'arrow-back' : 'close'} size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {picking ? (
          <>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search banks"
              placeholderTextColor="#9CA3AF"
              autoFocus
              className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 mb-3"
            />
            {banks.length === 0 ? (
              <ActivityIndicator color="#2563EB" className="my-6" />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(b) => b.code + b.name}
                style={{ maxHeight: 360 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => { setBank(item); setPicking(false); }} className="py-3 border-b border-gray-100">
                    <Text className="text-sm text-gray-900">{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        ) : (
          <>
            <Text className="text-xs font-semibold text-gray-600 mb-1.5">Bank</Text>
            <TouchableOpacity onPress={() => setPicking(true)} className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 mb-4">
              <Text className={bank ? 'text-gray-900 text-sm' : 'text-gray-400 text-sm'}>{bank?.name ?? 'Select bank'}</Text>
              <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
            </TouchableOpacity>

            <Text className="text-xs font-semibold text-gray-600 mb-1.5">Account number</Text>
            <TextInput
              value={accountNumber}
              onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit NUBAN"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 mb-3"
            />

            <View className="min-h-[24px] mb-4">
              {resolving ? (
                <ActivityIndicator color="#2563EB" size="small" />
              ) : accountName ? (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text className="text-sm font-bold text-green-700 ml-1.5">{accountName}</Text>
                </View>
              ) : null}
            </View>

            <Text className="text-[11px] text-gray-400 mb-4">
              The account name should match the name on your QwikHelp profile. Withdrawals are only sent to this account.
            </Text>

            <TouchableOpacity
              onPress={save}
              disabled={!accountName || saving}
              className={`rounded-xl py-3.5 items-center ${accountName ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Save account</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Withdraw: amount, transfer fee and what reaches the bank.
function WithdrawModal({ visible, wallet, onClose, onDone }: { visible: boolean; wallet: Wallet; onClose: () => void; onDone: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {visible && <WithdrawSheet wallet={wallet} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function WithdrawSheet({ wallet, onClose, onDone }: { wallet: Wallet; onClose: () => void; onDone: () => void }) {
  const supabase = useSupabase();
  const [amountText, setAmountText] = useState(String(wallet.available));
  const [sending, setSending] = useState(false);

  const amount = parseInt(amountText.replace(/\D/g, ''), 10) || 0;
  const fee = amount ? transferFee(amount) : 0;
  const tooLow = amount < wallet.min_withdrawal;
  const tooHigh = amount > wallet.available;

  const withdraw = async () => {
    setSending(true);
    try {
      const res = await callPayments<{ status: string }>(supabase, 'withdraw', { amount });
      alertService.alert(
        res.status === 'success' ? 'Withdrawal sent' : 'Withdrawal started',
        `${formatNaira(amount - fee)} is on its way to ${wallet.account?.bank_name}. ${res.status === 'success' ? '' : 'We\'ll notify you when it arrives.'}`
      );
      onDone();
    } catch (err) {
      alertService.alert('Withdrawal failed', errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end bg-black/40">
      <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-gray-900">Withdraw</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <Text className="text-xs font-semibold text-gray-600 mb-1.5">Amount (available {formatNaira(wallet.available)})</Text>
        <View className="flex-row items-center border border-gray-200 rounded-xl px-4 mb-4">
          <Text className="text-lg font-bold text-gray-900 mr-1">₦</Text>
          <TextInput
            value={amountText}
            onChangeText={(t) => setAmountText(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            className="flex-1 py-3 text-lg font-bold text-gray-900"
          />
        </View>

        <View className="bg-gray-50 rounded-xl p-3 mb-4">
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-500">Transfer fee (Paystack)</Text>
            <Text className="text-xs text-gray-700">-{formatNaira(fee)}</Text>
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-sm font-bold text-gray-900">You receive</Text>
            <Text className="text-sm font-bold text-gray-900">{formatNaira(Math.max(0, amount - fee))}</Text>
          </View>
          <Text className="text-[11px] text-gray-400 mt-2">
            To {wallet.account?.bank_name} ••{wallet.account?.account_last4} ({wallet.account?.account_name})
          </Text>
        </View>

        {(tooLow || tooHigh) && (
          <Text className="text-xs text-red-600 mb-3">
            {tooLow ? `The minimum withdrawal is ${formatNaira(wallet.min_withdrawal)}.` : `You can withdraw up to ${formatNaira(wallet.available)}.`}
          </Text>
        )}

        <TouchableOpacity
          onPress={withdraw}
          disabled={tooLow || tooHigh || sending}
          className={`rounded-xl py-3.5 items-center ${tooLow || tooHigh ? 'bg-gray-300' : 'bg-blue-600'}`}
        >
          {sending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Withdraw {formatNaira(amount)}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
