// "Hits" with a live ball. The ball bounces once when the screen appears, then rests.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, withDelay } from 'react-native-reanimated';
import { T } from './Text';
import { color } from '@/theme/tokens';
import { shadow } from '@/lib/shadow';
import { useMotion } from '@/lib/motion';

export function Wordmark({ tone = 'ink' as 'ink' | 'onCourt' }) {
  const { reduced } = useMotion();
  const y = useSharedValue(0), sq = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    y.value = withDelay(200, withSequence(withTiming(-26, { duration: 260, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 300, easing: Easing.bounce })));
    sq.value = withDelay(200, withSequence(withTiming(1.15, { duration: 260 }), withTiming(0.8, { duration: 80 }), withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2)) })));
  }, [reduced, y, sq]);
  const ball = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scaleY: sq.value }, { scaleX: 2 - sq.value }] }));
  return (
    <View style={s.row}>
      <T v="display" tone={tone} style={{ fontSize: 44, lineHeight: 46, letterSpacing: -2 }}>Hits</T>
      <Animated.View style={[s.ball, ball]} />
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  ball: { width: 14, height: 14, borderRadius: 7, backgroundColor: color.ball, borderWidth: 2, borderColor: color.ink, marginBottom: 8, ...shadow({ y: 2, blur: 4, opacity: 0.3, color: '#000000' }) },
});
