import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { tradeName } from '../../constants/kyc';
import { useCountdown } from '../../hooks/useCountdown';
import { alertService } from '../../lib/AlertService';
import { formatNaira, OfferStatus, OfferSummary, ProviderCard } from '../../lib/broadcast';

export type Offer = OfferSummary & { provider: ProviderCard };

interface OfferCardProps {
  offer: Offer;
  budget: number;
  onBook: (offer: Offer) => void;
  booking?: boolean;
  disabled?: boolean;
}

const CLOSED_LABEL: Partial<Record<OfferStatus, string>> = {
  declined: 'You declined this offer',
  walked_away: 'Provider walked away',
  expired: 'Offer expired',
  withdrawn: 'Provider withdrew',
  not_selected: 'Not selected',
  job_closed: 'Job closed',
};

// In-app chat and calls only; phone numbers are never shared.
const comingSoon = () =>
  alertService.alert('Coming Soon', 'In-app chat and calls with providers are coming in the next update.');

export const OfferCard: React.FC<OfferCardProps> = ({ offer, budget, onBook, booking, disabled }) => {
  const router = useRouter();
  const { label: timeLeft } = useCountdown(offer.expires_at);
  const p = offer.provider;
  const firstName = p.name.split(' ')[0];
  const closedLabel = CLOSED_LABEL[offer.status];

  return (
    <View className={`bg-white rounded-2xl p-4 mb-4 shadow-sm shadow-gray-100 ${closedLabel ? 'opacity-60' : ''}`}>
      {/* Provider Info */}
      <TouchableOpacity
        className="flex-row pb-4 items-center"
        onPress={() => router.push(`/provider-profile/${p.id}`)}
      >
        <Image
          source={{ uri: p.avatar_url || `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(p.name)}` }}
          className="w-12 h-12 rounded-full mr-3 bg-gray-100"
        />
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center flex-1 pr-2">
              <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>{p.name}</Text>
              {p.verified && <Ionicons name="shield-checkmark" size={14} color="#16A34A" style={{ marginLeft: 4 }} />}
            </View>
            <View className="flex-row items-center">
              <Ionicons name="star" size={14} color="#f97316" />
              <Text className="text-orange-500 font-bold text-xs ml-1">
                {p.review_count ? Number(p.rating).toFixed(1) : 'New'}
              </Text>
            </View>
          </View>
          <Text className="text-gray-500 text-xs mb-2" numberOfLines={2}>
            {p.bio || `${tradeName(p.trade ?? undefined) ?? 'Verified provider'}${p.years_experience ? ` • ${p.years_experience}` : ''}`}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Tags & Status */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row border border-gray-200 px-2 py-2 rounded-2xl items-center">
          <Ionicons name="location-outline" size={16} color="#9ca3af" />
          <Text className="text-gray-500 text-xs ml-1">
            {offer.distance_km != null ? `${offer.distance_km}km away` : 'Nearby'}
          </Text>
        </View>
        <StatusBadge offer={offer} budget={budget} firstName={firstName} closedLabel={closedLabel} />
      </View>

      {!closedLabel && (
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row border border-gray-200 px-2 py-2 rounded-2xl items-center">
            <Ionicons name="time-outline" size={16} color="#9ca3af" />
            <Text className="text-gray-500 text-xs ml-1">
              {timeLeft ? `${timeLeft} to respond` : 'Price locked'}
            </Text>
          </View>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={comingSoon}
              className="w-8 h-8 rounded-full border border-gray-100 items-center justify-center"
            >
              <Ionicons name="call" size={14} color="#2563eb" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={comingSoon}
              className="w-8 h-8 rounded-full border border-gray-100 items-center justify-center bg-blue-50"
            >
              <Ionicons name="chatbubble" size={14} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Action */}
      {offer.status === 'agreed' && (
        <TouchableOpacity
          onPress={() => onBook(offer)}
          disabled={booking || disabled}
          className={`w-full py-3.5 rounded-xl items-center ${disabled ? 'bg-gray-300' : 'bg-blue-600'}`}
        >
          {booking ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-sm">Book {firstName} for {formatNaira(offer.amount)}</Text>
          )}
        </TouchableOpacity>
      )}
      {offer.status === 'awaiting_customer' && (
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/booking/bargain/[offerId]', params: { offerId: offer.id } })}
          disabled={disabled}
          className="w-full bg-blue-600 py-3.5 rounded-xl items-center"
        >
          <Text className="text-white font-bold text-sm">Respond to Counter Offer</Text>
        </TouchableOpacity>
      )}
      {offer.status === 'awaiting_provider' && (
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/booking/bargain/[offerId]', params: { offerId: offer.id } })}
          className="w-full border-2 border-blue-600 py-3 rounded-xl items-center"
        >
          <Text className="text-blue-600 font-bold text-sm">View Negotiation</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

function StatusBadge({ offer, budget, firstName, closedLabel }: {
  offer: Offer;
  budget: number;
  firstName: string;
  closedLabel?: string;
}) {
  if (closedLabel) {
    return (
      <View className="bg-gray-200 px-3 py-1 rounded-full">
        <Text className="text-gray-600 font-bold text-xs">{closedLabel}</Text>
      </View>
    );
  }
  if (offer.status === 'agreed') {
    return (
      <View className="bg-green-500 px-3 py-1 rounded-full">
        <Text className="text-white font-bold text-xs">
          {offer.amount === budget ? 'Offer Accepted!' : `Agreed: ${formatNaira(offer.amount)}`}
        </Text>
      </View>
    );
  }
  if (offer.status === 'awaiting_customer') {
    return (
      <View className="bg-orange-500 px-3 py-1 rounded-full">
        <Text className="text-white font-bold text-xs">Counter Offer: {formatNaira(offer.provider_counter)}</Text>
      </View>
    );
  }
  return (
    <View className="bg-blue-100 px-3 py-1 rounded-full">
      <Text className="text-blue-700 font-bold text-xs">
        Waiting on {firstName}: {formatNaira(offer.customer_counter)}
      </Text>
    </View>
  );
}
