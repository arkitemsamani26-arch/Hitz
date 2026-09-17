import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { color } from '@/theme/tokens';
import { spring } from '@/lib/motion';

// Onboarding progress as a baseline filling with ball-yellow. No step counter, no
// "3 of 8" -- a line that gets longer.
export function Progress({ value }: { value: number }) {
  const w = useSharedValue(0);
  useEffect(() => { w.value = withSpring(Math.max(0.04, Math.min(1, value)), spring.land); }, [value, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <Animated.View style={[s.fill, a]} />
    </View>
  );
}
const s = StyleSheet.create({
  track: { height: 3, backgroundColor: color.line, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: color.ball, borderRadius: 2 },
});
