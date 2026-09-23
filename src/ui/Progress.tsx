import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { color } from '@/theme/tokens';
import { spring } from '@/lib/motion';

// Onboarding progress is a court line being painted.
export function Progress({ value }: { value: number }) {
  const w = useSharedValue(0);
  useEffect(() => { w.value = withSpring(Math.max(0.04, Math.min(1, value)), spring.land); }, [value, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={s.track} accessibilityRole="progressbar" accessibilityLabel="Sign-up progress" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <Animated.View style={[s.fill, a]} />
    </View>
  );
}
const s = StyleSheet.create({
  // The track has to carry its own contrast. At 12% navy it was painted onto whatever the
  // sky happened to be doing behind it -- and the sun sits right behind this bar, so the
  // line washed out in the middle and picked up again at the right, which reads as a bent
  // or broken bar rather than an unfilled one. Dark enough to hold its line over the sun,
  // and it is what gives the white fill something to sit on.
  track: { height: 5, backgroundColor: 'rgba(11,18,32,0.45)', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, backgroundColor: color.paper, borderRadius: 3 },
});
