// A stamp slamming down: scales in from large, lands with a tilt, bounces once.
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { T } from './Text';
import { color } from '@/theme/tokens';
import { useMotion } from '@/lib/motion';

export function Stamp({ text, tone = 'court' }: { text: string; tone?: 'court' | 'ink' | 'danger' }) {
  const { reduced } = useMotion();
  const sc = useSharedValue(reduced ? 1 : 2.2), op = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    op.value = withTiming(1, { duration: 80 });
    sc.value = withSequence(withTiming(0.92, { duration: 160 }), withSpring(1, { damping: 8, stiffness: 400 }));
  }, [reduced, sc, op]);
  const a = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ rotate: '-7deg' }, { scale: sc.value }] }));
  const c = color[tone];
  return (
    <Animated.View style={[s.stamp, { borderColor: c }, a]}>
      <T v="h2" tone={tone} style={{ letterSpacing: 2, textTransform: 'uppercase' }}>{text}</T>
    </Animated.View>
  );
}
const s = StyleSheet.create({ stamp: { alignSelf: 'center', borderWidth: 3, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.85)' } });
