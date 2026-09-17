// Loading state: a ball in a rally between two baselines. Not a spinner.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, cancelAnimation } from 'react-native-reanimated';
import { color, space } from '@/theme/tokens';
import { T } from './Text';
import { useMotion } from '@/lib/motion';

export function Rally({ label }: { label?: string }) {
  const { reduced } = useMotion();
  const x = useSharedValue(0);
  const yy = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    x.value = withRepeat(withSequence(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 520, easing: Easing.inOut(Easing.quad) })), -1);
    yy.value = withRepeat(withSequence(withTiming(-14, { duration: 260, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) })), -1);
    return () => { cancelAnimation(x); cancelAnimation(yy); };
  }, [reduced, x, yy]);
  const ball = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 120 - 60 }, { translateY: yy.value }] }));
  return (
    <View style={s.wrap} accessibilityLabel={label ?? 'Loading'} accessibilityRole="progressbar">
      <View style={s.court}>
        <View style={s.line} /><View style={[s.line, s.net]} /><View style={s.line} />
        <Animated.View style={[s.ball, ball]} />
      </View>
      {label && <T v="small" tone="ink3" center>{label}</T>}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.lg, paddingVertical: space.xxl },
  court: { width: 180, height: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  line: { width: 2, height: 28, backgroundColor: color.lineStrong },
  net: { height: 40, opacity: 0.6 },
  ball: { position: 'absolute', left: 84, top: 14, width: 12, height: 12, borderRadius: 6, backgroundColor: color.ball, shadowColor: color.ball, shadowOpacity: 0.7, shadowRadius: 8 },
});
