// Twelve small balls thrown out from a point, falling under gravity, fading. The moment
// something locks in.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { color } from '@/theme/tokens';
import { useMotion } from '@/lib/motion';

const N = 12;
export function BallBurst({ fire, size = 12, spread = 150 }: { fire: number; size?: number; spread?: number }) {
  const { reduced } = useMotion();
  const t = useSharedValue(0);
  useEffect(() => { if (!fire || reduced) return; t.value = 0; t.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }); }, [fire, reduced, t]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: N }, (_, i) => <Ball key={i} i={i} t={t} size={size} spread={spread} />)}
    </View>
  );
}
function Ball({ i, t, size, spread }: { i: number; t: SharedValue<number>; size: number; spread: number }) {
  const a = useAnimatedStyle(() => {
    const ang = (i / N) * Math.PI * 2 + 0.3, r = t.value * spread, g = t.value * t.value * spread * 0.8;
    return { opacity: t.value === 0 ? 0 : 1 - t.value, transform: [{ translateX: Math.cos(ang) * r }, { translateY: Math.sin(ang) * r * 0.5 + g }, { scale: 1 - t.value * 0.5 }] };
  });
  return <Animated.View style={[s.b, { width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, marginTop: -size / 2 }, a]} />;
}
const s = StyleSheet.create({ b: { position: 'absolute', left: '50%', top: '50%', backgroundColor: color.ball, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.25)' } });
