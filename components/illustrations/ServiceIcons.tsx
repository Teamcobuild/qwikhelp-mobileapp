import React from 'react';
import { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { Illustration, Layer, sparklePath } from './Motion';

// Animated service icons for the customer home cards. All drawn on a 64×64 grid.
const VB: [number, number] = [64, 64];

type IconProps = { size?: number };

export function CookingIcon({ size = 48 }: IconProps) {
  return (
    <Illustration width={size} height={size} viewBox={VB}>
      {/* steam */}
      {[22, 32, 42].map((x, i) => (
        <Layer key={x} motion={{ kind: 'rise', amount: 8, duration: 2000, delay: i * 500 }}>
          <Path d={`M${x} 16 q-3 -3 0 -6 q3 -3 0 -6`} stroke="#94A3B8" strokeWidth={2.5} strokeLinecap="round" fill="none" />
        </Layer>
      ))}
      {/* flames */}
      <Layer motion={{ kind: 'pulse', amount: 0.08, duration: 500, origin: [32, 60] }}>
        <Path d="M24 60 q-3 -4 1 -8 q0 3 2 3 q0 -3 3 -5 q-1 4 2 6 q1 2 -1 4 z" fill="#F97316" />
        <Path d="M33 60 q-3 -4 1 -8 q0 3 2 3 q0 -3 3 -5 q-1 4 2 6 q1 2 -1 4 z" fill="#EF4444" />
      </Layer>
      {/* pot */}
      <Layer>
        <Rect x={6} y={33} width={8} height={4} rx={2} fill="#9A3412" />
        <Rect x={50} y={33} width={8} height={4} rx={2} fill="#9A3412" />
        <Rect x={13} y={29} width={38} height={22} rx={7} fill="#F97316" />
        <Rect x={13} y={41} width={38} height={4} fill="#EA580C" />
        <Rect x={10} y={27} width={44} height={5} rx={2.5} fill="#C2410C" />
      </Layer>
      {/* lid, rattling */}
      <Layer motion={{ kind: 'swing', amount: 4, duration: 700, origin: [32, 27] }}>
        <Path d="M14 27 Q32 13 50 27 Z" fill="#FB923C" />
        <Rect x={29} y={15} width={6} height={4} rx={2} fill="#9A3412" />
      </Layer>
    </Illustration>
  );
}

export function CleaningIcon({ size = 48 }: IconProps) {
  return (
    <Illustration width={size} height={size} viewBox={VB}>
      {/* bubbles */}
      {[
        [50, 22, 3.5, 0],
        [56, 30, 2.5, 400],
        [48, 34, 2, 800],
      ].map(([x, y, r, d]) => (
        <Layer key={`${x}-${y}`} motion={{ kind: 'rise', amount: 10, duration: 1800, delay: d }}>
          <Circle cx={x} cy={y} r={r} fill="#BFDBFE" stroke="#60A5FA" strokeWidth={1} />
        </Layer>
      ))}
      <Layer motion={{ kind: 'pulse', amount: 0.3, duration: 900, origin: [54, 46] }}>
        <Path d={sparklePath(54, 46, 5)} fill="#FBBF24" />
      </Layer>
      {/* bottle, gentle tilt */}
      <Layer motion={{ kind: 'swing', amount: 5, duration: 1600, origin: [28, 58] }}>
        <Path d="M16 10 h18 l4 7 h-24 z" fill="#1E3A8A" />
        <Rect x={34} y={10} width={10} height={5} rx={1.5} fill="#1E3A8A" />
        <Path d="M20 17 l-2 7" stroke="#1E3A8A" strokeWidth={3} strokeLinecap="round" />
        <Rect x={21} y={17} width={14} height={9} fill="#1D4ED8" />
        <Rect x={15} y={25} width={26} height={33} rx={7} fill="#3B82F6" />
        <Rect x={19} y={33} width={18} height={14} rx={3} fill="#DBEAFE" />
        <Path d="M22 40 h12 M22 36 h8" stroke="#60A5FA" strokeWidth={2} strokeLinecap="round" />
      </Layer>
    </Illustration>
  );
}

export function LaundryIcon({ size = 48 }: IconProps) {
  return (
    <Illustration width={size} height={size} viewBox={VB}>
      <Layer>
        <Rect x={11} y={6} width={42} height={52} rx={7} fill="#8B5CF6" />
        <Rect x={11} y={6} width={42} height={12} rx={7} fill="#7C3AED" />
        <Rect x={11} y={13} width={42} height={5} fill="#7C3AED" />
        <Circle cx={19} cy={12} r={2.5} fill="#EDE9FE" />
        <Circle cx={26} cy={12} r={2.5} fill="#C4B5FD" />
        <Rect x={36} y={10} width={12} height={4} rx={2} fill="#C4B5FD" />
        <Circle cx={32} cy={38} r={15} fill="#EDE9FE" stroke="#5B21B6" strokeWidth={3} />
      </Layer>
      {/* drum */}
      <Layer motion={{ kind: 'spin', duration: 2400, origin: [32, 38] }}>
        <Path d="M21 40 q5.5 -5 11 0 t11 0 a11 11 0 0 1 -22 0 z" fill="#A78BFA" />
        <Rect x={25} y={29} width={8} height={5} rx={2} fill="#F472B6" />
        <Circle cx={37} cy={32} r={2} fill="#FFFFFF" />
        <Circle cx={27} cy={44} r={1.6} fill="#FFFFFF" />
      </Layer>
      <Layer>
        <Path d="M24 31 a11 11 0 0 1 8 -4" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.8} />
      </Layer>
    </Illustration>
  );
}

export function CompanionIcon({ size = 48 }: IconProps) {
  return (
    <Illustration width={size} height={size} viewBox={VB}>
      <Layer motion={{ kind: 'pulse', amount: 0.18, duration: 700, origin: [32, 12] }}>
        <Path d="M32 18 C25 13 23 10 23 7.5 A4.5 4.5 0 0 1 32 6 A4.5 4.5 0 0 1 41 7.5 C41 10 39 13 32 18 Z" fill="#EF4444" />
      </Layer>
      <Layer motion={{ kind: 'float', amount: 2, duration: 2000 }}>
        <Circle cx={22} cy={28} r={7} fill="#FBCFE8" />
        <Path d="M15 26 a7 7 0 0 1 14 0 q-4 -3 -7 -2 q-4 0 -7 2 z" fill="#831843" />
        <Path d="M9 58 q0 -18 13 -18 q13 0 13 18 z" fill="#EC4899" />
      </Layer>
      <Layer motion={{ kind: 'float', amount: 2, duration: 2000, delay: 1000 }}>
        <Circle cx={42} cy={30} r={7} fill="#FDE68A" />
        <Path d="M35 28 a7 7 0 0 1 14 0 l0 -1 q-7 -4 -14 1 z" fill="#3F2A14" />
        <Path d="M29 58 q0 -16 13 -16 q13 0 13 16 z" fill="#8B5CF6" />
      </Layer>
    </Illustration>
  );
}

export function TourGuideIcon({ size = 48 }: IconProps) {
  return (
    <Illustration width={size} height={size} viewBox={VB}>
      <Layer>
        <Path d="M6 20 L22 14 L40 20 L58 14 V52 L40 58 L22 52 L6 58 Z" fill="#BBF7D0" stroke="#16A34A" strokeWidth={2} strokeLinejoin="round" />
        <Path d="M22 14 V52 M40 20 V58" stroke="#16A34A" strokeWidth={1.5} />
        <Path d="M12 48 Q20 34 28 42 T44 30" stroke="#F97316" strokeWidth={2} strokeDasharray="3 3" strokeLinecap="round" fill="none" />
        <Circle cx={12} cy={48} r={2.5} fill="#F97316" />
      </Layer>
      <Layer motion={{ kind: 'pulse', amount: 0.3, duration: 900, origin: [46, 34] }}>
        <Ellipse cx={46} cy={34} rx={5} ry={1.8} fill="#15803D" opacity={0.35} />
      </Layer>
      <Layer motion={{ kind: 'float', amount: 5, duration: 900 }}>
        <Path d="M46 6 c-5.5 0 -9.5 4 -9.5 9.5 c0 7 9.5 16 9.5 16 s9.5 -9 9.5 -16 c0 -5.5 -4 -9.5 -9.5 -9.5 z" fill="#EF4444" />
        <Circle cx={46} cy={15.5} r={3.5} fill="#FFFFFF" />
      </Layer>
    </Illustration>
  );
}

export function PlumbingIcon({ size = 48 }: IconProps) {
  return (
    <Illustration width={size} height={size} viewBox={VB}>
      <Layer>
        <Path d="M4 22 H30 a10 10 0 0 1 10 10 V40" stroke="#64748B" strokeWidth={9} fill="none" />
        <Rect x={14} y={16} width={6} height={12} rx={1.5} fill="#475569" />
        <Rect x={33} y={36} width={14} height={6} rx={1.5} fill="#475569" />
      </Layer>
      {/* drips */}
      {[0, 800].map((d) => (
        <Layer key={d} motion={{ kind: 'drip', amount: 12, duration: 1600, delay: d }}>
          <Path d="M40 44 c0 0 -4 5 -4 7.5 a4 4 0 0 0 8 0 c0 -2.5 -4 -7.5 -4 -7.5 z" fill="#3B82F6" />
        </Layer>
      ))}
      {/* wrench, turning */}
      <Layer motion={{ kind: 'swing', amount: 12, duration: 1000, origin: [52, 30] }}>
        <G transform="rotate(-35 50 20)">
          <Rect x={47} y={18} width={6} height={18} rx={3} fill="#F59E0B" />
          <Path d="M42 9 a3 3 0 0 1 3 -3 h2 v7 h6 v-7 h2 a3 3 0 0 1 3 3 v7 a3 3 0 0 1 -3 3 h-10 a3 3 0 0 1 -3 -3 z" fill="#D97706" />
        </G>
      </Layer>
    </Illustration>
  );
}

export function ElectricalIcon({ size = 48 }: IconProps) {
  return (
    <Illustration width={size} height={size} viewBox={VB}>
      <Layer motion={{ kind: 'pulse', amount: 0.2, duration: 1100, origin: [32, 24] }}>
        <Circle cx={32} cy={24} r={21} fill="#FEF08A" opacity={0.7} />
      </Layer>
      <Layer motion={{ kind: 'blink', amount: 0.85, duration: 700 }}>
        <Line x1={8} y1={12} x2={4} y2={9} stroke="#FACC15" strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={56} y1={12} x2={60} y2={9} stroke="#FACC15" strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={6} y1={28} x2={2} y2={28} stroke="#FACC15" strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={58} y1={28} x2={62} y2={28} stroke="#FACC15" strokeWidth={2.5} strokeLinecap="round" />
      </Layer>
      <Layer>
        <Path d="M32 7 a15 15 0 0 0 -9 27 c2 2 3 4 3 7 h12 c0 -3 1 -5 3 -7 a15 15 0 0 0 -9 -27 z" fill="#FDE047" stroke="#EAB308" strokeWidth={1.5} />
        <Path d="M27 32 l3 -8 l2 4 l2 -4 l3 8" stroke="#CA8A04" strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Path d="M24 15 a9 9 0 0 1 6 -4" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" />
        <Rect x={25} y={41} width={14} height={4} rx={1.5} fill="#94A3B8" />
        <Rect x={25} y={46} width={14} height={4} rx={1.5} fill="#64748B" />
        <Rect x={28} y={51} width={8} height={4} rx={2} fill="#475569" />
      </Layer>
    </Illustration>
  );
}

export function GardeningIcon({ size = 48 }: IconProps) {
  return (
    <Illustration width={size} height={size} viewBox={VB}>
      <Layer motion={{ kind: 'spin', duration: 9000, origin: [54, 10] }}>
        <Circle cx={54} cy={10} r={5} fill="#FBBF24" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <Line key={a} x1={54} y1={2} x2={54} y2={0} stroke="#FBBF24" strokeWidth={2} strokeLinecap="round" transform={`rotate(${a} 54 10)`} />
        ))}
      </Layer>
      {/* leaves sway from the base of the stem */}
      <Layer motion={{ kind: 'swing', amount: 6, duration: 2000, origin: [32, 40] }}>
        <Path d="M32 40 V14" stroke="#15803D" strokeWidth={3} strokeLinecap="round" />
        <Path d="M32 32 C21 32 16 24 16 17 C25 17 32 23 32 32 Z" fill="#22C55E" />
        <Path d="M32 25 C43 25 48 17 48 10 C39 10 32 16 32 25 Z" fill="#16A34A" />
        <Path d="M32 32 L20 20 M32 25 L44 13" stroke="#15803D" strokeWidth={1.2} />
        <Circle cx={32} cy={12} r={3} fill="#F472B6" />
      </Layer>
      <Layer>
        <Rect x={17} y={38} width={30} height={6} rx={2} fill="#C2410C" />
        <Path d="M20 44 h24 l-3 15 h-18 z" fill="#EA580C" />
        <Path d="M22 49 h20" stroke="#C2410C" strokeWidth={1.5} />
      </Layer>
    </Illustration>
  );
}

export function CarpentryIcon({ size = 48 }: IconProps) {
  return (
    <Illustration width={size} height={size} viewBox={VB}>
      <Layer>
        <Rect x={6} y={44} width={52} height={10} rx={2} fill="#D97706" />
        <Path d="M10 49 h44" stroke="#B45309" strokeWidth={1.2} />
        <Rect x={30} y={38} width={3} height={7} fill="#64748B" />
      </Layer>
      <Layer motion={{ kind: 'swing', amount: 18, duration: 600, origin: [44, 40] }}>
        <G transform="rotate(-30 44 40)">
          <Rect x={41} y={14} width={6} height={28} rx={2.5} fill="#92400E" />
          <Path d="M34 10 h20 a2 2 0 0 1 2 2 v5 a2 2 0 0 1 -2 2 h-20 l-4 -4.5 z" fill="#475569" />
        </G>
      </Layer>
    </Illustration>
  );
}

// Keyed by services.ts slug.
export const SERVICE_ICONS: Record<string, (p: IconProps) => React.JSX.Element> = {
  cooking: CookingIcon,
  cleaning: CleaningIcon,
  laundry: LaundryIcon,
  companion: CompanionIcon,
  'tour-guide': TourGuideIcon,
  plumber: PlumbingIcon,
  electrician: ElectricalIcon,
  gardeners: GardeningIcon,
  carpentry: CarpentryIcon,
};
