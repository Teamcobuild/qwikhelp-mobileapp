import { Ionicons } from '@expo/vector-icons';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { serviceName } from '../../constants/services';
import { useCountdown } from '../../hooks/useCountdown';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { alertService } from '../../lib/AlertService';
import {
  errorMessage,
  FeedItem,
  formatJobDate,
  formatJobTime,
  formatNaira,
  OfferEvent,
  signJobPhotos,
} from '../../lib/broadcast';
import { useSupabase } from '../../lib/supabase';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

const roundTo100 = (n: number) => Math.round(n / 100) * 100;

export default function JobRequestScreen() {
  // Customer photos may show private spaces (e.g. bedrooms). Blocks screenshots/recording on Android;
  // on iOS it hides content from screen recording and the app switcher.
  usePreventScreenCapture();

  const router = useRouter();
  const supabase = useSupabase();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();

  const [item, setItem] = useState<FeedItem | null>(null);
  const [events, setEvents] = useState<OfferEvent[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [counterMode, setCounterMode] = useState(false);
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) return;
    const { data, error } = await supabase.rpc('get_provider_feed');
    if (error) {
      alertService.alert('Error', errorMessage(error));
      return;
    }
    const found = (data as FeedItem[]).find((f) => f.id === jobId) ?? null;
    setItem(found);
    setLoaded(true);

    if (found?.offer) {
      const { data: detail } = await supabase.rpc('get_offer_detail', { p_offer: found.offer.id });
      setEvents(detail?.events ?? []);
    } else {
      setEvents([]);
    }
  }, [supabase, jobId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!item?.photo_paths.length) return;
    signJobPhotos(supabase, item.photo_paths).then(setPhotos).catch(() => setPhotos([]));
  }, [supabase, item?.photo_paths.join(',')]);

  useRealtimeRefresh(jobId ? `request:${jobId}` : null, [
    { table: 'offers', filter: `job_id=eq.${jobId}` },
    { table: 'jobs', filter: `id=eq.${jobId}` },
  ], load);

  const offer = item?.offer ?? null;
  const { label: offerTimer, expired: offerExpired } = useCountdown(offer?.expires_at);
  const { label: jobTimer } = useCountdown(item?.expires_at);

  const counterSuggestions = useMemo(() => {
    if (!item) return [];
    const b = item.budget;
    return [...new Set([b + 500, b + 1000, roundTo100(b * 1.2), roundTo100(b * 1.5)])]
      .filter((v) => v > b && v <= b * 3)
      .sort((x, y) => x - y);
  }, [item]);

  const run = async (key: string, fn: () => PromiseLike<{ error: unknown }>, after?: () => void) => {
    setBusy(key);
    try {
      const { error } = await fn();
      if (error) throw error;
      after?.();
      await load();
    } catch (err) {
      alertService.alert('Could Not Send', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const accept = () =>
    run('accept', () => supabase.rpc('provider_respond', { p_job: jobId, p_action: 'accept', p_note: note.trim() || null }));

  const sendCounter = () => {
    if (!item) return;
    const amount = parseInt(price.replace(/\D/g, ''), 10);
    if (!(amount > item.budget && amount <= item.budget * 3)) {
      return alertService.alert(
        'Invalid Amount',
        `Your counter must be above ${formatNaira(item.budget)} and at most ${formatNaira(item.budget * 3)}.`
      );
    }
    run(
      'counter',
      () => supabase.rpc('provider_respond', { p_job: jobId, p_action: 'counter', p_amount: amount, p_note: note.trim() || null }),
      () => {
        setCounterMode(false);
        setNote('');
      }
    );
  };

  const finalAnswer = (action: 'accept' | 'walk_away') =>
    run(action, () => supabase.rpc('provider_final', { p_offer: offer!.id, p_action: action, p_note: note.trim() || null }));

  const withdraw = () =>
    alertService.alert('Withdraw Offer?', 'The customer will no longer be able to book you for this job.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: () => run('withdraw', () => supabase.rpc('withdraw_offer', { p_offer: offer!.id })) },
    ]);

  const dismiss = () =>
    run('dismiss', () => supabase.rpc('dismiss_job', { p_job: jobId }), () => router.back());

  if (!loaded) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center px-8">
        <Ionicons name="time-outline" size={36} color="#9CA3AF" />
        <Text className="text-base font-bold text-gray-900 mt-3">This request is no longer available</Text>
        <Text className="text-xs text-gray-500 text-center mt-1">
          The customer may have booked someone else, cancelled, or the request expired.
        </Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="bg-blue-600 px-8 py-3 rounded-xl mt-6">
          <Text className="text-white font-bold">Back to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isNew = !offer;
  const finalCounterPending = offer?.status === 'awaiting_provider' && !offerExpired;

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]">
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-lg font-bold text-gray-900">Job Request</Text>
          {/* Balances the back button so the title stays centred without covering it. */}
          <View className="w-10" />
        </View>

        <KeyboardAwareScrollView bottomOffset={24} className="flex-1 px-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Summary */}
          <View className="bg-white rounded-[22px] border border-gray-200 p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-2xl bg-blue-50 items-center justify-center">
                  <Text className="text-blue-600 font-bold text-lg">{item.customer_name.charAt(0)}</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[16px] font-bold text-gray-900">{item.customer_name}</Text>
                  <Text className="text-xs text-gray-500">
                    {serviceName(item.category)}{item.sub_category ? ` • ${item.sub_category}` : ''}
                  </Text>
                </View>
              </View>
              {jobTimer && isNew && (
                <View className="bg-gray-100 px-2.5 py-1 rounded-md">
                  <Text className="text-[11px] font-bold text-gray-600">Open {jobTimer}</Text>
                </View>
              )}
            </View>

            <View className="flex-row items-center mt-4">
              <Ionicons name="location-sharp" size={14} color="#16A34A" />
              <Text className="text-xs font-semibold text-gray-800 ml-1.5 flex-1" numberOfLines={1}>
                {item.landmark} • {item.distance_km}km away
              </Text>
            </View>
            <View className="flex-row items-center mt-2">
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text className="text-xs font-semibold text-gray-800 ml-1.5">
                {formatJobDate(item.scheduled_at)}, {formatJobTime(item.scheduled_at)} • {item.duration_hours} hrs
              </Text>
            </View>

            <Text className="text-sm font-medium text-gray-900 mt-3 leading-5">{item.description}</Text>

            <View className="flex-row items-center justify-between border-t border-gray-100 pt-3 mt-4">
              <Text className="text-xs text-gray-500">Customer&apos;s offer (workmanship)</Text>
              <Text className="text-lg font-bold text-blue-600">{formatNaira(item.budget)}</Text>
            </View>
          </View>

          {/* Photos */}
          {photos.length > 0 && <PhotoStrip photos={photos} />}

          {/* Negotiation History */}
          {events.length > 0 && (
            <View className="bg-white rounded-[22px] border border-gray-200 p-4 mb-4">
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Negotiation</Text>
              {events.map((e, idx) => (
                <View key={idx} className="flex-row items-start mb-2">
                  <Ionicons
                    name={e.actor === 'provider' ? 'person-circle' : 'person-circle-outline'}
                    size={18}
                    color={e.actor === 'provider' ? '#2563EB' : '#6B7280'}
                  />
                  <View className="ml-2 flex-1">
                    <Text className="text-sm text-gray-900">
                      <Text className="font-bold">{e.actor === 'provider' ? 'You' : item.customer_name}</Text>{' '}
                      {describeEvent(e)}
                    </Text>
                    {!!e.note && <Text className="text-xs text-gray-500 mt-0.5">&ldquo;{e.note}&rdquo;</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Status */}
          {offer && (
            <OfferStatusBanner
              status={offer.status}
              amount={offer.amount}
              customerName={item.customer_name}
              timer={offerExpired ? null : offerTimer}
            />
          )}

          {/* Counter input (round 1) */}
          {isNew && counterMode && (
            <View className="bg-white rounded-[22px] border border-gray-200 p-4 mb-4">
              <Text className="text-gray-900 font-bold mb-1">Your counter offer</Text>
              <Text className="text-gray-400 text-xs mb-3">
                You get one counter. Up to {formatNaira(item.budget * 3)}.
              </Text>
              <View className="relative justify-center mb-3">
                <Text className="absolute left-4 top-3.5 text-gray-900 text-base font-bold z-10">₦</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder={String(counterSuggestions[0] ?? '')}
                  className="border border-blue-200 rounded-xl pl-9 pr-4 py-3 bg-white text-gray-900 font-bold text-base"
                />
              </View>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {counterSuggestions.map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setPrice(String(amt))}
                    className={`px-3 py-1.5 rounded-lg border ${price === String(amt) ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200'}`}
                  >
                    <Text className={`font-medium text-xs ${price === String(amt) ? 'text-blue-700' : 'text-gray-500'}`}>
                      {formatNaira(amt)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Why this price? (optional)"
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={300}
                className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-900 text-sm"
                textAlignVertical="top"
                style={{ minHeight: 70 }}
              />
            </View>
          )}

          <View className="h-40" />
        </KeyboardAwareScrollView>

        {/* Actions */}
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 pb-8">
          {isNew && !counterMode && (
            <>
              <ActionButton label={`Accept ${formatNaira(item.budget)}`} onPress={accept} loading={busy === 'accept'} disabled={!!busy} />
              <ActionButton label="Counter Offer" variant="outline" onPress={() => setCounterMode(true)} disabled={!!busy} />
              <TouchableOpacity onPress={dismiss} disabled={!!busy} className="py-2 items-center">
                <Text className="text-sm font-semibold text-gray-500">Not interested</Text>
              </TouchableOpacity>
            </>
          )}
          {isNew && counterMode && (
            <>
              <ActionButton label="Send Counter Offer" onPress={sendCounter} loading={busy === 'counter'} disabled={!!busy} />
              <TouchableOpacity onPress={() => setCounterMode(false)} className="py-2 items-center">
                <Text className="text-sm font-semibold text-gray-500">Back</Text>
              </TouchableOpacity>
            </>
          )}
          {finalCounterPending && (
            <>
              <ActionButton
                label={`Accept ${formatNaira(offer!.customer_counter)}`}
                onPress={() => finalAnswer('accept')}
                loading={busy === 'accept'}
                disabled={!!busy}
              />
              <ActionButton
                label="Walk Away"
                variant="danger"
                onPress={() => finalAnswer('walk_away')}
                loading={busy === 'walk_away'}
                disabled={!!busy}
              />
            </>
          )}
          {offer && (offer.status === 'awaiting_customer' || offer.status === 'agreed') && (
            <ActionButton label="Withdraw Offer" variant="outline" onPress={withdraw} loading={busy === 'withdraw'} disabled={!!busy} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function describeEvent(e: OfferEvent) {
  switch (e.action) {
    case 'accept': return `accepted ${formatNaira(e.amount)}`;
    case 'counter': return `countered with ${formatNaira(e.amount)}`;
    case 'decline': return 'declined the offer';
    case 'walk_away': return 'walked away';
    case 'withdraw': return 'withdrew the offer';
    default: return e.action;
  }
}

function OfferStatusBanner({ status, amount, customerName, timer }: {
  status: string;
  amount: number;
  customerName: string;
  timer: string | null;
}) {
  const copy: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string; title: string; body: string }> = {
    awaiting_customer: {
      icon: 'hourglass-outline', bg: 'bg-amber-50', color: '#D97706',
      title: `Waiting for ${customerName}`,
      body: `Your counter of ${formatNaira(amount)} has been sent.`,
    },
    awaiting_provider: {
      icon: 'alert-circle-outline', bg: 'bg-blue-50', color: '#2563EB',
      title: 'Final offer from the customer',
      body: `${customerName} offered ${formatNaira(amount)}. Accept or walk away; there are no more counters.`,
    },
    agreed: {
      icon: 'checkmark-circle-outline', bg: 'bg-emerald-50', color: '#059669',
      title: `Price agreed: ${formatNaira(amount)}`,
      body: `${customerName} is comparing offers and will pick a provider. You'll be notified if you're booked.`,
    },
  };
  const c = copy[status];
  if (!c) return null;
  return (
    <View className={`${c.bg} rounded-[22px] p-4 mb-4 flex-row items-start`}>
      <Ionicons name={c.icon} size={20} color={c.color} />
      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-bold text-gray-900 flex-1">{c.title}</Text>
          {timer && <Text className="text-xs font-bold" style={{ color: c.color }}>{timer}</Text>}
        </View>
        <Text className="text-xs text-gray-600 mt-1 leading-4">{c.body}</Text>
      </View>
    </View>
  );
}

function ActionButton({ label, onPress, loading, disabled, variant = 'primary' }: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
}) {
  const styles = {
    primary: { box: 'bg-blue-600', text: 'text-white', spinner: 'white' },
    outline: { box: 'bg-white border-2 border-blue-600', text: 'text-blue-600', spinner: '#2563EB' },
    danger: { box: 'bg-white border-2 border-red-500', text: 'text-red-600', spinner: '#DC2626' },
  }[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`h-[52px] rounded-xl items-center justify-center mb-2.5 ${styles.box}`}
    >
      {loading ? <ActivityIndicator color={styles.spinner} /> : <Text className={`font-bold text-base ${styles.text}`}>{label}</Text>}
    </TouchableOpacity>
  );
}

function PhotoStrip({ photos }: { photos: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const width = Dimensions.get('window').width;
  return (
    <View className="bg-white rounded-[22px] border border-gray-200 p-4 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider">Photos</Text>
        <View className="flex-row items-center">
          <Ionicons name="lock-closed" size={11} color="#9CA3AF" />
          <Text className="text-[11px] text-gray-400 ml-1">Screenshot protected</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {photos.map((uri) => (
          <TouchableOpacity key={uri} onPress={() => setOpen(uri)} className="mr-3">
            <Image source={{ uri }} className="w-28 h-28 rounded-xl bg-gray-100" />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(null)} className="flex-1 bg-black items-center justify-center">
          {open && <Image source={{ uri: open }} style={{ width, height: width }} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
