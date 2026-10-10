import React from 'react';
import { Pressable, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useMotion } from '@/lib/motion';
import { haptic } from '@/lib/haptics';

const APressable = Animated.createAnimatedComponent(Pressable);

// Press feedback: 130ms down to 0.975, 130ms back. Nothing springs.
export function Tap({ style, onPressIn, onPressOut, onPress, scaleTo = 0.975, tick = false, ...rest }:
  PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; tick?: boolean }) {
  const { reduced } = useMotion();
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      onPressIn={e => { if (!reduced) s.value = withTiming(scaleTo, { duration: 130 }); onPressIn?.(e); }}
      onPressOut={e => { if (!reduced) s.value = withTiming(1, { duration: 130 }); onPressOut?.(e); }}
      onPress={e => { if (tick) haptic.tick(); onPress?.(e); }}
      style={[a, style]}
    />
  );
}
