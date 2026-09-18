// Loading: a matchup. Two players on opposite sides of the net, a ball crossing it.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { CourtSurface } from './Court';
import { T } from './Text';
import { color, space } from '@/theme/tokens';
import { useMotion } from '@/lib/motion';

export function Rally({ label, a = '8.0', b = '8.1' }: { label?: string; a?: string; b?: string }) {
  const { reduced } = useMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withSequence(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) })), -1);
    return () => cancelAnimation(t);
  }, [reduced, t]);
  // Arc: linear across the court, parabolic lift, small shadow offset.
  const ball = useAnimatedStyle(() => {
    const y = 92 - t.value * 184;              // far baseline to near baseline
    const lift = -Math.sin(t.value * Math.PI) * 26;
    return { transform: [{ translateY: y + lift }, { translateX: (t.value - 0.5) * 30 }, { scale: 1 + Math.sin(t.value * Math.PI) * 0.35 }] };
  });
  const shadow = useAnimatedStyle(() => ({ transform: [{ translateY: 92 - t.value * 184 }, { translateX: (t.value - 0.5) * 30 }], opacity: 0.35 - Math.sin(t.value * Math.PI) * 0.25 }));
  const far = useAnimatedStyle(() => ({ transform: [{ translateX: -(t.value - 0.5) * 12 }] }));
  const near = useAnimatedStyle(() => ({ transform: [{ translateX: (t.value - 0.5) * 12 }] }));
  return (
    <View style={s.wrap} accessibilityLabel={label ?? 'Loading'} accessibilityRole="progressbar">
      <CourtSurface style={s.court}>
        <Animated.View style={[s.player, { top: 22 }, far]}><T v="smallM" style={s.num}>{b}</T></Animated.View>
        <Animated.View style={[s.player, { bottom: 22 }, near]}><T v="smallM" style={s.num}>{a}</T></Animated.View>
        <Animated.View style={[s.shadow, shadow]} />
        <Animated.View style={[s.ball, ball]} />
      </CourtSurface>
      {label && <T v="small" tone="onCourt" center>{label}</T>}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.lg, paddingVertical: space.xl },
  court: { width: 120, height: 220 },
  player: { position: 'absolute', left: '50%', marginLeft: -19, width: 38, height: 38, borderRadius: 19, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
  num: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 13, color: color.ink },
  ball: { position: 'absolute', left: '50%', top: '50%', marginLeft: -7, marginTop: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: color.ball, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.25)' },
  shadow: { position: 'absolute', left: '50%', top: '50%', marginLeft: -7, marginTop: -3, width: 14, height: 6, borderRadius: 7, backgroundColor: '#000' },
});
