// A one-shot squash when something toggles on: the ball hitting the strings.
import React, { useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';
import { useMotion } from '@/lib/motion';

export function Pop({ on, children, style }: { on: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { reduced } = useMotion();
  const s = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduced || !on) return;
    s.value = withSequence(withTiming(0.86, { duration: 60 }), withSpring(1.08, { damping: 6, stiffness: 420 }), withSpring(1, { damping: 12, stiffness: 300 }));
  }, [on, reduced, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}
