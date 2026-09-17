import React from 'react';
import { Pressable, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring } from '@/lib/motion';
import { haptic } from '@/lib/haptics';

const APressable = Animated.createAnimatedComponent(Pressable);

// Press feedback with weight: scales down on press-in, springs back on release.
export function Tap({ style, onPressIn, onPressOut, onPress, scaleTo = 0.965, tick = false, ...rest }:
  PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; tick?: boolean }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      onPressIn={e => { s.value = withSpring(scaleTo, spring.press); onPressIn?.(e); }}
      onPressOut={e => { s.value = withSpring(1, spring.press); onPressOut?.(e); }}
      onPress={e => { if (tick) haptic.tick(); onPress?.(e); }}
      style={[a, style]}
    />
  );
}
