// The swipe stack. Right sends a real request. Left passes. No mutual-match gate.
import React, { useCallback } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, Extrapolation } from 'react-native-reanimated';
import { PlayerCard } from './Player';
import { T } from './Text';
import { Button } from './Button';
import { color, space } from '@/theme/tokens';
import { spring, useMotion } from '@/lib/motion';
import { haptic } from '@/lib/haptics';
import type { Player } from '@/data/types';

const THRESH = 110;

export function SwipeStack({ players, onRequest, onPass, onOpen, canRequest }:
  { players: Player[]; onRequest: (p: Player) => void; onPass: (p: Player) => void; onOpen: (p: Player) => void; canRequest: boolean }) {
  const { width } = useWindowDimensions();
  const { reduced } = useMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const top = players[0];
  const next = players[1];

  const commit = useCallback((dir: 1 | -1, p: Player) => {
    if (dir === 1) onRequest(p); else onPass(p);
  }, [onRequest, onPass]);

  const fling = useCallback((dir: 1 | -1) => {
    if (!top) return;
    if (dir === 1 && !canRequest) { haptic.warn(); x.value = withSpring(0, spring.snap); y.value = withSpring(0, spring.snap); return; }
    const off = dir * (width + 120);
    const done = () => { commit(dir, top); x.value = 0; y.value = 0; };
    if (reduced) { x.value = withTiming(off, { duration: 120 }, () => runOnJS(done)()); }
    else { x.value = withSpring(off, spring.fling, () => runOnJS(done)()); }
  }, [top, canRequest, width, commit, reduced, x, y]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate(e => { x.value = e.translationX; y.value = e.translationY * 0.4; })
    .onEnd(e => {
      const past = Math.abs(e.translationX) > THRESH || Math.abs(e.velocityX) > 900;
      if (past) runOnJS(fling)(e.translationX > 0 ? 1 : -1);
      else { x.value = withSpring(0, spring.snap); y.value = withSpring(0, spring.snap); }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${interpolate(x.value, [-width, 0, width], [-9, 0, 9])}deg` }],
  }));
  const hitLabel = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, THRESH], [0, 1], Extrapolation.CLAMP) }));
  const passLabel = useAnimatedStyle(() => ({ opacity: interpolate(-x.value, [20, THRESH], [0, 1], Extrapolation.CLAMP) }));
  const nextStyle = useAnimatedStyle(() => {
    const t = interpolate(Math.abs(x.value), [0, THRESH], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ scale: 0.94 + 0.06 * t }, { translateY: 14 - 14 * t }], opacity: 0.7 + 0.3 * t };
  });

  if (!top) return null;
  return (
    <View style={s.wrap}>
      <View style={s.deck}>
        {next && <Animated.View style={[s.abs, nextStyle]} pointerEvents="none"><PlayerCard p={next} tall /></Animated.View>}
        <GestureDetector gesture={pan}>
          <Animated.View style={[s.abs, cardStyle]}>
            <Animated.View style={s.tapArea} onTouchEnd={undefined}>
              <PlayerCard p={top} tall />
            </Animated.View>
            <Animated.View style={[s.label, s.labelHit, hitLabel]} pointerEvents="none"><T v="h2" tone="onBall">HIT?</T></Animated.View>
            <Animated.View style={[s.label, s.labelPass, passLabel]} pointerEvents="none"><T v="h2">PASS</T></Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
      {/* Buttons exist so the stack is fully usable without a gesture. */}
      <View style={s.actions}>
        <Button title="Pass" kind="line" onPress={() => fling(-1)} style={{ flex: 1 }} />
        <Button title="See profile" kind="ghost" onPress={() => onOpen(top)} small />
        <Button title="Hit" onPress={() => fling(1)} style={{ flex: 1 }} disabled={!canRequest} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, gap: space.lg },
  deck: { flex: 1, minHeight: 400 },
  abs: { position: 'absolute', left: 0, right: 0, top: 0 },
  tapArea: {},
  label: { position: 'absolute', top: 18, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  labelHit: { left: 18, backgroundColor: color.ball, transform: [{ rotate: '-8deg' }] },
  labelPass: { right: 18, borderWidth: 2, borderColor: color.ink, transform: [{ rotate: '8deg' }] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
