import React from 'react';
import { Text, View } from 'react-native';
import { Circle, Ellipse, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Illustration, Layer, sparklePath } from './Motion';

// Animated illustrations for empty lists. All drawn on a 200×160 grid.
const VB: [number, number] = [200, 160];

type ArtProps = { width?: number };
const h = (w: number) => (w * VB[1]) / VB[0];

// Soft backdrop + ground shadow shared by every scene.
function Backdrop() {
  return (
    <Layer>
      <Circle cx={100} cy={78} r={62} fill="#EFF6FF" />
      <Ellipse cx={100} cy={146} rx={52} ry={6} fill="#E5E7EB" />
    </Layer>
  );
}

function Sparkles({ points }: { points: [number, number, number][] }) {
  return (
    <>
      {points.map(([x, y, r], i) => (
        <Layer key={`${x}-${y}`} motion={{ kind: 'blink', amount: 0.85, duration: 1100, delay: i * 350 }}>
          <Path d={sparklePath(x, y, r)} fill={i % 2 ? '#FBBF24' : '#93C5FD'} />
        </Layer>
      ))}
    </>
  );
}

export function EmptyBookingsArt({ width = 220 }: ArtProps) {
  return (
    <Illustration width={width} height={h(width)} viewBox={VB}>
      <Backdrop />
      <Sparkles points={[[42, 36, 7], [162, 30, 6], [170, 92, 5]]} />
      <Layer motion={{ kind: 'float', amount: 4, duration: 2600 }}>
        <Rect x={62} y={28} width={76} height={104} rx={12} fill="#FFFFFF" stroke="#BFDBFE" strokeWidth={3} />
        <Rect x={83} y={20} width={34} height={16} rx={6} fill="#2563EB" />
        <Circle cx={100} cy={28} r={3} fill="#DBEAFE" />
        {[54, 76, 98].map((y, i) => (
          <React.Fragment key={y}>
            <Rect x={74} y={y - 6} width={12} height={12} rx={3} fill={i === 0 ? '#2563EB' : '#FFFFFF'} stroke="#93C5FD" strokeWidth={2} />
            {i === 0 && <Path d={`M77 ${y} l2.5 2.5 l4.5 -5`} stroke="#FFFFFF" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            <Rect x={92} y={y - 4} width={i === 2 ? 22 : 34} height={8} rx={4} fill="#DBEAFE" />
          </React.Fragment>
        ))}
      </Layer>
      {/* magnifier searching */}
      <Layer motion={{ kind: 'swing', amount: 10, duration: 1800, origin: [168, 132] }}>
        <Path d="M152 116 L170 134" stroke="#1E3A8A" strokeWidth={9} strokeLinecap="round" />
        <Circle cx={140} cy={104} r={19} fill="#DBEAFE" fillOpacity={0.85} stroke="#2563EB" strokeWidth={6} />
        <Path d="M130 98 a11 11 0 0 1 9 -6" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" />
      </Layer>
    </Illustration>
  );
}

export function EmptyMessagesArt({ width = 220 }: ArtProps) {
  return (
    <Illustration width={width} height={h(width)} viewBox={VB}>
      <Backdrop />
      <Sparkles points={[[40, 112, 6], [166, 40, 7]]} />
      <Layer>
        <Path d="M50 36 h76 a14 14 0 0 1 14 14 v20 a14 14 0 0 1 -14 14 h-56 l-14 12 v-12 h-6 a14 14 0 0 1 -14 -14 v-20 a14 14 0 0 1 14 -14 z" fill="#2563EB" />
      </Layer>
      {/* typing dots */}
      {[72, 88, 104].map((x, i) => (
        <Layer key={x} motion={{ kind: 'float', amount: 4, duration: 450, delay: i * 150 }}>
          <Circle cx={x} cy={62} r={5} fill="#FFFFFF" />
        </Layer>
      ))}
      <Layer motion={{ kind: 'float', amount: 5, duration: 2200, delay: 1100 }}>
        <Path d="M100 92 h56 a12 12 0 0 1 12 12 v14 a12 12 0 0 1 -12 12 h-4 v10 l-12 -10 h-40 a12 12 0 0 1 -12 -12 v-14 a12 12 0 0 1 12 -12 z" fill="#FFFFFF" stroke="#BFDBFE" strokeWidth={3} />
        <Rect x={102} y={104} width={44} height={6} rx={3} fill="#DBEAFE" />
        <Rect x={102} y={116} width={28} height={6} rx={3} fill="#DBEAFE" />
      </Layer>
    </Illustration>
  );
}

export function EmptyNotificationsArt({ width = 220 }: ArtProps) {
  return (
    <Illustration width={width} height={h(width)} viewBox={VB}>
      <Backdrop />
      {/* sleepy z's */}
      {[
        [138, 52, 14, 0],
        [150, 38, 11, 700],
        [160, 26, 9, 1400],
      ].map(([x, y, s, d]) => (
        <Layer key={x} motion={{ kind: 'rise', amount: 12, duration: 2100, delay: d }}>
          <SvgText x={x} y={y} fontSize={s} fontWeight="bold" fill="#60A5FA">z</SvgText>
        </Layer>
      ))}
      {/* bell rocks gently from its top */}
      <Layer motion={{ kind: 'swing', amount: 7, duration: 2000, origin: [100, 30] }}>
        <Circle cx={100} cy={30} r={7} fill="#F59E0B" />
        <Circle cx={100} cy={122} r={10} fill="#D97706" />
        <Path d="M100 34 c-24 0 -38 18 -38 40 v20 l-12 16 h100 l-12 -16 v-20 c0 -22 -14 -40 -38 -40 z" fill="#FBBF24" />
        <Rect x={50} y={106} width={100} height={8} rx={4} fill="#F59E0B" />
        <Path d="M80 54 a24 24 0 0 1 14 -10" stroke="#FEF3C7" strokeWidth={5} strokeLinecap="round" fill="none" />
        {/* closed eyes */}
        <Path d="M86 82 q5 4 10 0 M104 82 q5 4 10 0" stroke="#92400E" strokeWidth={3} strokeLinecap="round" fill="none" />
      </Layer>
    </Illustration>
  );
}

export function EmptyJobsArt({ width = 220 }: ArtProps) {
  return (
    <Illustration width={width} height={h(width)} viewBox={VB}>
      <Backdrop />
      <Sparkles points={[[46, 46, 7], [158, 34, 6], [164, 100, 5]]} />
      <Layer motion={{ kind: 'float', amount: 5, duration: 2400 }}>
        <Path d="M84 58 v-10 a7 7 0 0 1 7 -7 h18 a7 7 0 0 1 7 7 v10" stroke="#1E3A8A" strokeWidth={7} fill="none" />
        <Rect x={52} y={56} width={96} height={70} rx={12} fill="#2563EB" />
        <Rect x={52} y={56} width={96} height={30} rx={12} fill="#3B82F6" />
        <Rect x={52} y={80} width={96} height={8} fill="#1D4ED8" />
        <Rect x={91} y={76} width={18} height={18} rx={4} fill="#FBBF24" />
        <Circle cx={100} cy={85} r={3} fill="#B45309" />
      </Layer>
    </Illustration>
  );
}

export function EmptyEarningsArt({ width = 220 }: ArtProps) {
  return (
    <Illustration width={width} height={h(width)} viewBox={VB}>
      <Backdrop />
      {/* coins hovering above the wallet */}
      {[
        [80, 40, 0],
        [104, 28, 400],
        [126, 44, 800],
      ].map(([x, y, d]) => (
        <Layer key={x} motion={{ kind: 'float', amount: 7, duration: 1500, delay: d }}>
          <Circle cx={x} cy={y} r={13} fill="#FBBF24" stroke="#F59E0B" strokeWidth={3} />
          <SvgText x={x} y={y + 5} fontSize={14} fontWeight="bold" fill="#B45309" textAnchor="middle">₦</SvgText>
        </Layer>
      ))}
      <Layer motion={{ kind: 'float', amount: 2, duration: 2400 }}>
        <Rect x={46} y={62} width={108} height={70} rx={14} fill="#10B981" />
        <Path d="M46 76 a14 14 0 0 1 14 -14 h80 a14 14 0 0 1 14 14 v2 h-108 z" fill="#059669" />
        <Rect x={112} y={86} width={50} height={28} rx={10} fill="#047857" />
        <Circle cx={128} cy={100} r={5} fill="#D1FAE5" />
        <Path d="M60 116 h30" stroke="#6EE7B7" strokeWidth={4} strokeLinecap="round" />
      </Layer>
    </Illustration>
  );
}

// Illustration + title + message, used by every empty list.
export function EmptyState({
  art,
  title,
  message,
  className = '',
}: {
  art: React.ReactNode;
  title: string;
  message?: string;
  className?: string;
}) {
  return (
    <View className={`items-center px-6 ${className}`}>
      {art}
      <Text className="text-base font-bold text-gray-900 mt-2 text-center">{title}</Text>
      {!!message && <Text className="text-sm text-gray-500 text-center mt-1 leading-5">{message}</Text>}
    </View>
  );
}
