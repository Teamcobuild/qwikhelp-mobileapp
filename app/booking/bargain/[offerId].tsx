import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { serviceName } from '../../../constants/services';
import { useCountdown } from '../../../hooks/useCountdown';
import { useRealtimeRefresh } from '../../../hooks/useRealtimeRefresh';
import { alertService } from '../../../lib/AlertService';
import {
  errorMessage,
  formatJobDate,
  formatJobTime,
  formatNaira,
  OfferDetail,
  OfferEvent,
} from '../../../lib/broadcast';
import { useSupabase } from '../../../lib/supabase';

const roundTo100 = (n: number) => Math.round(n / 100) * 100;

export default function BargainScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { offerId } = useLocalSearchParams<{ offerId: string }>();

  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'accept' | 'decline' | 'counter' | 'book' | null>(null);

  const load = useCallback(async () => {
    if (!offerId) return;
    const { data, error } = await supabase.rpc('get_offer_detail', { p_offer: offerId });
    if (error) setLoadError(errorMessage(error));
    else setOffer(data as OfferDetail);
  }, [supabase, offerId]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(offerId ? `bargain:${offerId}` : null, [{ table: 'offers', filter: `id=eq.${offerId}` }], load);

  const { label: timeLeft, expired } = useCountdown(offer?.expires_at);

  // Suggested final offers strictly between the opening budget and the provider's counter.
  const suggestions = useMemo(() => {
    if (!offer?.provider_counter) return [];
    const low = offer.job.budget;
    const high = offer.provider_counter;
    return [...new Set([0.25, 0.5, 0.75].map((f) => roundTo100(low + (high - low) * f)))]
      .filter((v) => v > low && v < high);
  }, [offer]);

  // Until the customer types, pre-fill the middle suggestion.
  const priceValue = price || (suggestions.length ? String(suggestions[Math.floor(suggestions.length / 2)]) : '');

  const respond = async (action: 'accept' | 'decline' | 'counter') => {
    if (!offer) return;
    const amount = parseInt(priceValue.replace(/\D/g, ''), 10);
    if (action === 'counter') {
      if (!(amount > offer.job.budget && amount < (offer.provider_counter ?? 0))) {
        return alertService.alert(
          'Invalid Amount',
          `Your final offer must be between ${formatNaira(offer.job.budget)} and ${formatNaira(offer.provider_counter)}.`
        );
      }
    }
    setBusy(action);
    try {
      const { error } = await supabase.rpc('customer_respond', {
        p_offer: offer.id,
        p_action: action,
        p_amount: action === 'counter' ? amount : null,
        p_note: note.trim() || null,
      });
      if (error) throw error;
      setNote('');
      await load();
      if (action === 'decline') router.back();
    } catch (err) {
      alertService.alert('Could Not Send', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const confirmCounter = () => {
    alertService.alert(
      'Send Final Offer?',
      `This is your last counter. ${offer?.provider.name.split(' ')[0]} can only accept or walk away.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => respond('counter') },
      ]
    );
  };

  const book = async () => {
    if (!offer) return;
    setBusy('book');
    try {
      const { data, error } = await supabase.rpc('select_offer', { p_offer: offer.id });
      if (error) throw error;
      if (!data.ok) {
        alertService.alert('Provider Unavailable', 'This provider just got booked elsewhere. Please choose another offer.');
      }
      router.replace({ pathname: '/booking/offers/[jobId]', params: { jobId: offer.job_id } });
    } catch (err) {
      alertService.alert('Booking Failed', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!offer) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-8">
        {loadError ? (
          <Text className="text-gray-500 text-center">{loadError}</Text>
        ) : (
          <ActivityIndicator size="large" color="#2563EB" />
        )}
      </SafeAreaView>
    );
  }

  const p = offer.provider;
  const firstName = p.name.split(' ')[0];
  const avatar = p.avatar_url || `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(p.name)}`;
  const myTurn = offer.status === 'awaiting_customer' && !expired;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-6 py-4">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
            <Text className="flex-1 text-center text-lg font-bold text-gray-900 -ml-8">
              Bargain with {firstName}
            </Text>
          </View>
          <Text className="text-gray-400 text-center text-sm">
            {myTurn ? 'Accept, decline, or send one final counter offer.' : statusHint(offer, firstName)}
          </Text>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Job Summary Card (Simplified) */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm shadow-gray-100">
            <View className="flex-row items-center mb-3">
              <Text className="text-gray-400 font-medium mr-2">Service:</Text>
              <Text className="text-gray-900 font-bold">{serviceName(offer.job.category)}</Text>
            </View>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-600 font-medium">{offer.job.duration_hours} Hours</Text>
              <Text className="text-gray-600 font-medium">{formatJobDate(offer.job.scheduled_at)}</Text>
              <Text className="text-gray-600 font-medium">{formatJobTime(offer.job.scheduled_at)}</Text>
            </View>
            <View className="flex-row items-center border-t border-gray-100 pt-4 mt-2">
              <Text className="text-gray-400 font-medium mr-2">Your budget:</Text>
              <Text className="text-gray-900 font-bold text-lg">{formatNaira(offer.job.budget)}</Text>
            </View>
          </View>

          {/* Provider Card */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm shadow-gray-100">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <TouchableOpacity
                className="flex-row items-center flex-1"
                onPress={() => router.push(`/provider-profile/${p.id}`)}
              >
                <Image source={{ uri: avatar }} className="w-12 h-12 rounded-full mr-3 bg-gray-100" />
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>{p.name}</Text>
                    {p.verified && <Ionicons name="shield-checkmark" size={14} color="#16A34A" style={{ marginLeft: 4 }} />}
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={14} color="#f97316" />
                    <Text className="text-orange-500 font-bold text-xs ml-1">
                      {p.review_count ? Number(p.rating).toFixed(1) : 'New'}
                    </Text>
                    {offer.distance_km != null && (
                      <Text className="text-gray-400 text-xs ml-2">• {offer.distance_km}km away</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
              {timeLeft && !expired && (
                <View className="bg-orange-50 px-2.5 py-1 rounded-full flex-row items-center">
                  <Ionicons name="time-outline" size={12} color="#ea580c" />
                  <Text className="text-orange-600 font-bold text-xs ml-1">{timeLeft}</Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Text className="text-gray-900 font-medium mr-2">
                  {offer.status === 'agreed' ? 'Agreed:' : 'Offer:'}
                </Text>
                <Text className="text-gray-900 font-bold text-lg">{formatNaira(offer.amount)}</Text>
              </View>
              {myTurn && (
                <TouchableOpacity
                  onPress={() => respond('accept')}
                  disabled={!!busy}
                  className="bg-blue-600 px-8 py-2.5 rounded-xl"
                >
                  {busy === 'accept' ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Accept</Text>}
                </TouchableOpacity>
              )}
              {offer.status === 'agreed' && offer.job.status === 'open' && (
                <TouchableOpacity onPress={book} disabled={!!busy} className="bg-blue-600 px-6 py-2.5 rounded-xl">
                  {busy === 'book' ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Book {firstName}</Text>}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Negotiation History */}
          <View className="mb-4">
            {offer.events.map((event, index) => (
              <EventBubble key={index} event={event} avatar={avatar} providerName={p.name} />
            ))}
          </View>

          {/* Input Section (round 2: final counter) */}
          {myTurn && (
            <View className="bg-white rounded-2xl p-4 mb-8 shadow-sm shadow-gray-100">
              <Text className="text-gray-900 font-bold mb-1">Your final offer</Text>
              <Text className="text-gray-400 text-xs mb-3">
                Between {formatNaira(offer.job.budget)} and {formatNaira(offer.provider_counter)}. You only get one counter.
              </Text>
              <View className="relative justify-center mb-4">
                <Text className="absolute left-4 top-3.5 text-gray-900 text-base font-bold z-10">₦</Text>
                <TextInput
                  value={priceValue}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  className="border border-blue-200 rounded-xl pl-9 pr-4 py-3 bg-white text-gray-900 font-bold text-base"
                />
              </View>

              {/* Quick Chips */}
              <View className="flex-row flex-wrap gap-2 mb-6">
                {suggestions.map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setPrice(String(amt))}
                    className={`px-3 py-1.5 rounded-lg border ${priceValue === String(amt) ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200'}`}
                  >
                    <Text className={`font-medium text-xs ${priceValue === String(amt) ? 'text-blue-700' : 'text-gray-500'}`}>
                      {formatNaira(amt)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Note Input */}
              <Text className="text-gray-900 font-medium mb-2 text-sm">Add Note (Optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Reason for your offer"
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={300}
                numberOfLines={3}
                className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-900 text-sm mb-4"
                textAlignVertical="top"
                style={{ minHeight: 80 }}
              />

              <TouchableOpacity
                onPress={confirmCounter}
                disabled={!!busy}
                className="w-full bg-blue-600 py-3.5 rounded-xl items-center mb-3"
              >
                {busy === 'counter' ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Send Final Offer</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => respond('decline')} disabled={!!busy} className="py-2 items-center">
                <Text className="text-red-600 font-bold text-sm">Decline {firstName}&apos;s offer</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function statusHint(offer: OfferDetail, firstName: string) {
  switch (offer.status) {
    case 'awaiting_customer': return 'This counter offer has expired.';
    case 'awaiting_provider': return `Waiting for ${firstName} to accept or walk away.`;
    case 'agreed': return 'Price agreed. Book now or compare other offers.';
    case 'selected': return `${firstName} is booked for this job.`;
    case 'walked_away': return `${firstName} walked away from this job.`;
    case 'declined': return `You declined ${firstName}'s offer.`;
    case 'expired': return 'This offer expired.';
    default: return 'This offer is closed.';
  }
}

const EVENT_TEXT: Record<string, (e: OfferEvent) => string> = {
  accept: (e) => `Accepted ${formatNaira(e.amount)}`,
  counter: (e) => `Countered with ${formatNaira(e.amount)}`,
  decline: () => 'Declined the offer',
  walk_away: () => 'Walked away',
  withdraw: () => 'Withdrew the offer',
  select: (e) => `Booked for ${formatNaira(e.amount)}`,
  capacity_withdrawn: () => 'No longer available at this time',
};

function EventBubble({ event, avatar, providerName }: { event: OfferEvent; avatar: string; providerName: string }) {
  const text = EVENT_TEXT[event.action]?.(event) ?? event.action;
  if (event.actor === 'provider') {
    return (
      <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm shadow-gray-100">
        <View className="flex-row items-center mb-3">
          <Image source={{ uri: avatar }} className="w-10 h-10 rounded-full mr-3 bg-gray-100" />
          <View>
            <Text className="text-gray-900 font-bold text-sm mb-0.5">{providerName}</Text>
            <Text className="text-gray-500 text-xs">{text}</Text>
          </View>
        </View>
        {!!event.note && (
          <View className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <Text className="text-gray-600 text-sm">{event.note}</Text>
          </View>
        )}
      </View>
    );
  }
  if (event.actor === 'customer') {
    return (
      <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm shadow-gray-100">
        <View className="flex-row items-center justify-end mb-2">
          <Text className="text-gray-900 font-bold">You: {text}</Text>
        </View>
        {!!event.note && (
          <View className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <Text className="text-blue-900 text-sm text-right">{event.note}</Text>
          </View>
        )}
      </View>
    );
  }
  return (
    <Text className="text-center text-gray-400 text-xs mb-3">{text}</Text>
  );
}
