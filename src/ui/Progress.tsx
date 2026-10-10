import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { makeStyles } from '@/theme/theme';

// Onboarding progress: a thin line filling in.
export function Progress({ value }: { value: number }) {
  const s = useS();
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(Math.max(0.04, Math.min(1, value)), { duration: 220 }); }, [value, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={s.track} accessibilityRole="progressbar" accessibilityLabel="Sign-up progress" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <Animated.View style={[s.fill, a]} />
    </View>
  );
}
const useS = makeStyles(c => ({
  track: { height: 4, backgroundColor: c.line, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: c.green, borderRadius: 2 },
}));
