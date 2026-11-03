import React, { createContext, useContext, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

// Illustrations are stacks of full-size SVG layers sharing one viewBox; each layer gets its own looping motion.
// Amounts and origins are in viewBox units so drawings stay resolution independent.

export type MotionKind = 'float' | 'swing' | 'pulse' | 'spin' | 'rise' | 'blink' | 'drip';

export interface Motion {
  kind: MotionKind;
  amount?: number; // px of travel (float/rise/drip), degrees (swing), scale delta (pulse), opacity drop (blink)
  duration?: number;
  delay?: number;
  origin?: [number, number]; // pivot for swing/spin/pulse, viewBox units
}

const DEFAULTS: Record<MotionKind, { amount: number; duration: number }> = {
  float: { amount: 4, duration: 2400 },
  swing: { amount: 8, duration: 1800 },
  pulse: { amount: 0.12, duration: 1400 },
  spin: { amount: 360, duration: 4000 },
  rise: { amount: 14, duration: 2200 },
  blink: { amount: 0.75, duration: 1200 },
  drip: { amount: 14, duration: 1600 },
};

// One-way loops restart from the beginning; the rest ping-pong.
const ONE_WAY: MotionKind[] = ['spin', 'rise', 'drip'];

const Ctx = createContext({ width: 0, height: 0, vw: 1, vh: 1 });

export function Illustration({
  width,
  height,
  viewBox,
  children,
}: {
  width: number;
  height: number;
  viewBox: [number, number];
  children: React.ReactNode;
}) {
  return (
    <Ctx.Provider value={{ width, height, vw: viewBox[0], vh: viewBox[1] }}>
      <View style={{ width, height }} pointerEvents="none">
        {children}
      </View>
    </Ctx.Provider>
  );
}

export function Layer({ motion, children }: { motion?: Motion; children: React.ReactNode }) {
  const { width, height, vw, vh } = useContext(Ctx);
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  const kind = motion?.kind;
  const amount = motion?.amount ?? (kind ? DEFAULTS[kind].amount : 0);
  const duration = motion?.duration ?? (kind ? DEFAULTS[kind].duration : 0);
  const delay = motion?.delay ?? 0;
  const scale = width / vw;
  const animated = !!kind && !reduceMotion;

  useEffect(() => {
    if (!animated || !kind) return;
    const oneWay = ONE_WAY.includes(kind);
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: oneWay ? Easing.linear : Easing.inOut(Easing.sin) }),
        -1,
        !oneWay
      )
    );
    return () => cancelAnimation(t);
  }, [animated, kind, duration, delay, t]);

  const style = useAnimatedStyle(() => {
    if (!animated) return {};
    const v = t.value;
    switch (kind) {
      case 'float':
        return { transform: [{ translateY: -amount * scale * v }] };
      case 'swing':
        return { transform: [{ rotate: `${interpolate(v, [0, 1], [-amount, amount])}deg` }] };
      case 'pulse':
        return { transform: [{ scale: 1 + amount * v }] };
      case 'spin':
        return { transform: [{ rotate: `${amount * v}deg` }] };
      case 'rise':
        return { opacity: interpolate(v, [0, 0.25, 1], [0, 1, 0]), transform: [{ translateY: -amount * scale * v }] };
      case 'drip':
        return { opacity: interpolate(v, [0, 0.15, 0.75, 1], [0, 1, 1, 0]), transform: [{ translateY: amount * scale * v }] };
      case 'blink':
        return { opacity: 1 - amount * v };
      default:
        return {};
    }
  });

  const origin = motion?.origin;
  const transformOrigin = origin ? `${(origin[0] / vw) * 100}% ${(origin[1] / vh) * 100}%` : undefined;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, transformOrigin ? { transformOrigin } : null, style]}>
      <Svg width={width} height={height} viewBox={`0 0 ${vw} ${vh}`}>
        {children}
      </Svg>
    </Animated.View>
  );
}

// 4-point sparkle centred on (x, y).
export const sparklePath = (x: number, y: number, r: number) =>
  `M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z`;
