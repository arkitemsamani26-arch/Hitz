// The showpiece. Two levels slam in from opposite sides, meet in the middle, and the
// court lights come up. Built to be screenshotted into a group chat.
import React, { useEffect, useState } from 'react';
import { Modal, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './Text';
import { Button } from './Button';
import { CourtLines } from './Court';
import { color, space } from '@/theme/tokens';
import { spring, useMotion } from '@/lib/motion';
import { haptic } from '@/lib/haptics';
import { levelBig, windowShout } from '@/lib/format';
import type { HitRequest, Profile } from '@/data/types';

export function MatchFound({ req, me, open, onDone }: { req: HitRequest; me: Profile; open: boolean; onDone: () => void }) {
  const { reduced } = useMotion();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [landed, setLanded] = useState(false);

  const left = useSharedValue(-width);
  const right = useSharedValue(width);
  const flash = useSharedValue(0);
  const shake = useSharedValue(0);
  const details = useSharedValue(0);
  const lines = useSharedValue(0);

  useEffect(() => {
    if (!open) return;
    setLanded(false);
    if (reduced) {
      left.value = 0; right.value = 0; details.value = withTiming(1, { duration: 300 }); lines.value = withTiming(1, { duration: 400 });
      setLanded(true); haptic.confirmed();
      return;
    }
    left.value = -width; right.value = width; flash.value = 0; details.value = 0; lines.value = 0;
    const land = () => { haptic.confirmed(); setLanded(true); };
    left.value = withDelay(250, withSpring(0, spring.land));
    right.value = withDelay(250, withSpring(0, spring.land, f => { if (f) runOnJS(land)(); }));
    flash.value = withDelay(520, withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 380, easing: Easing.out(Easing.quad) })));
    shake.value = withDelay(520, withSequence(withTiming(-6, { duration: 40 }), withTiming(5, { duration: 50 }), withTiming(-3, { duration: 50 }), withTiming(0, { duration: 60 })));
    lines.value = withDelay(700, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    details.value = withDelay(850, withSpring(1, spring.snap));
  }, [open, reduced, width, left, right, flash, shake, details, lines]);

  const lS = useAnimatedStyle(() => ({ transform: [{ translateX: left.value }] }));
  const rS = useAnimatedStyle(() => ({ transform: [{ translateX: right.value }] }));
  const flashS = useAnimatedStyle(() => ({ opacity: flash.value * 0.9 }));
  const shakeS = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const detS = useAnimatedStyle(() => ({ opacity: details.value, transform: [{ translateY: (1 - details.value) * 24 }] }));
  const lineS = useAnimatedStyle(() => ({ opacity: lines.value }));

  const start = new Date(req.windowStart);
  const share = () => {
    void Share.share({ message: `It's on. ${me.displayName} vs ${req.other.displayName} · ${windowShout(start)} · ${req.courtName}` }).catch(() => {});
  };

  return (
    <Modal visible={open} animationType={reduced ? 'fade' : 'none'} onRequestClose={onDone}>
      <View style={[s.root, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color.ball }, flashS]} pointerEvents="none" />
        <Animated.View style={[s.lines, lineS]} pointerEvents="none"><CourtLines width={Math.min(width * 0.82, 380)} opacity={0.13} /></Animated.View>

        <View style={{ flex: 1 }} />
        <Animated.View style={[s.row, shakeS]}>
          <Animated.View style={[s.side, lS]}>
            <T v="score" tone={landed ? 'ball' : 'ink'} style={s.num}>{levelBig(me.levelValue)}</T>
            <T v="micro" tone="ink2">{me.displayName}</T>
          </Animated.View>
          <T v="h1" tone="ink3" style={{ marginHorizontal: 6 }}>·</T>
          <Animated.View style={[s.side, rS, { alignItems: 'flex-end' }]}>
            <T v="score" tone={landed ? 'ball' : 'ink'} style={s.num}>{levelBig(req.other.levelValue)}</T>
            <T v="micro" tone="ink2">{req.other.displayName}</T>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[s.details, detS]}>
          <T v="display" center>IT'S ON.</T>
          <T v="h2" tone="ball" center style={{ marginTop: space.md }}>{windowShout(start)}</T>
          <T v="bodyM" tone="ink2" center>{req.courtName}</T>
        </Animated.View>
        <View style={{ flex: 1 }} />

        <Animated.View style={[s.actions, detS]}>
          <Button title="Share it" kind="line" onPress={share} style={{ flex: 1 }} />
          <Button title="Done" onPress={onDone} style={{ flex: 1 }} />
        </Animated.View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.court, paddingHorizontal: space.xl, alignItems: 'center' },
  lines: { position: 'absolute', top: '10%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' },
  side: { alignItems: 'flex-start', minWidth: 120 },
  num: { fontSize: 88, lineHeight: 88, letterSpacing: -4 },
  details: { marginTop: space.xxl, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: space.md, width: '100%', maxWidth: 480 },
});
