// The showpiece. Sky, court, the ball crosses the net and the two numbers stand up on
// either side of it. Built to be posted to a story without being asked.
import React, { useEffect, useState } from 'react';
import { Modal, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './Text';
import { Button } from './Button';
import { CourtSurface } from './Court';
import { Sky } from './Screen';
import { color, space } from '@/theme/tokens';
import { spring, useMotion } from '@/lib/motion';
import { haptic } from '@/lib/haptics';
import { levelBig, windowShout } from '@/lib/format';
import type { HitRequest, Profile } from '@/data/types';

export function MatchFound({ req, me, open, onDone }: { req: HitRequest; me: Profile; open: boolean; onDone: () => void }) {
  const { reduced } = useMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [landed, setLanded] = useState(false);
  const courtH = Math.min(height * 0.62, 560);

  const ball = useSharedValue(0);      // 0 near baseline -> 1 far baseline
  const near = useSharedValue(0);      // number pop
  const far = useSharedValue(0);
  const banner = useSharedValue(0);
  const details = useSharedValue(0);

  useEffect(() => {
    if (!open) return;
    setLanded(false);
    if (reduced) { ball.value = 1; near.value = 1; far.value = 1; banner.value = withTiming(1, { duration: 300 }); details.value = withTiming(1, { duration: 300 }); setLanded(true); haptic.confirmed(); return; }
    ball.value = 0; near.value = 0; far.value = 0; banner.value = 0; details.value = 0;
    const land = () => { haptic.confirmed(); setLanded(true); };
    near.value = withDelay(200, withSpring(1, spring.land));
    ball.value = withDelay(500, withTiming(1, { duration: 720, easing: Easing.inOut(Easing.quad) }, f => { if (f) runOnJS(land)(); }));
    far.value = withDelay(1180, withSpring(1, spring.land));
    banner.value = withDelay(1300, withSequence(withSpring(1.12, spring.snap), withSpring(1, spring.snap)));
    details.value = withDelay(1500, withSpring(1, spring.snap));
  }, [open, reduced, ball, near, far, banner, details]);

  const ballS = useAnimatedStyle(() => {
    const y = (1 - ball.value) * (courtH - 60) + 30;
    const lift = -Math.sin(ball.value * Math.PI) * 90;
    return { transform: [{ translateY: y + lift }, { translateX: (ball.value - 0.5) * 60 }, { scale: 1 + Math.sin(ball.value * Math.PI) * 0.6 }], opacity: ball.value >= 1 ? 0 : 1 };
  });
  const nearS = useAnimatedStyle(() => ({ transform: [{ scale: near.value }, { translateY: (1 - near.value) * 40 }], opacity: near.value }));
  const farS = useAnimatedStyle(() => ({ transform: [{ scale: far.value }, { translateY: (1 - far.value) * -40 }], opacity: far.value }));
  const bannerS = useAnimatedStyle(() => ({ transform: [{ scale: banner.value }], opacity: Math.min(1, banner.value) }));
  const detS = useAnimatedStyle(() => ({ opacity: details.value, transform: [{ translateY: (1 - details.value) * 20 }] }));

  const start = new Date(req.windowStart);
  const share = () => { void Share.share({ message: `It's on. ${me.displayName} vs ${req.other.displayName} · ${windowShout(start)} · ${req.courtName}` }).catch(() => {}); };

  return (
    <Modal visible={open} animationType={reduced ? 'fade' : 'none'} onRequestClose={onDone}>
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }]}>
        <Sky height={insets.top + 140} />
        <View style={{ height: insets.top + 60 }} />
        <CourtSurface style={[s.court, { height: courtH, width: Math.min(width - 48, 380) }]}>
          <Animated.View style={[s.side, { top: '10%' }, farS]}>
            <T v="micro" tone="onCourt">{req.other.displayName}</T>
            <T v="score" tone={landed ? 'ball' : 'onCourt'} style={s.num}>{levelBig(req.other.levelValue)}</T>
          </Animated.View>
          <Animated.View style={[s.side, { bottom: '10%' }, nearS]}>
            <T v="score" tone={landed ? 'ball' : 'onCourt'} style={s.num}>{levelBig(me.levelValue)}</T>
            <T v="micro" tone="onCourt">{me.displayName}</T>
          </Animated.View>
          <Animated.View style={[s.banner, bannerS]} pointerEvents="none">
            <T v="display" tone="onBall" style={{ fontSize: 44, lineHeight: 46 }}>IT'S ON.</T>
          </Animated.View>
          <Animated.View style={[s.ball, ballS]} />
        </CourtSurface>
        <Animated.View style={[s.details, detS]}>
          <T v="h1" tone="onCourt" center>{windowShout(start)}</T>
          <T v="bodyM" tone="onCourt" center style={{ opacity: 0.9 }}>{req.courtName}</T>
        </Animated.View>
        <View style={{ flex: 1 }} />
        <Animated.View style={[s.actions, detS]}>
          <Button title="Share it" kind="white" onPress={share} style={{ flex: 1 }} />
          <Button title="Done" kind="ball" onPress={onDone} style={{ flex: 1 }} />
        </Animated.View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ground, paddingHorizontal: space.xl, alignItems: 'center' },
  court: { alignSelf: 'center' },
  side: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  num: { fontSize: 84, lineHeight: 88, letterSpacing: -4, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 0, textShadowOffset: { width: 0, height: 4 } },
  banner: { position: 'absolute', left: -8, right: -8, top: '50%', marginTop: -30, backgroundColor: color.ball, paddingVertical: 6, alignItems: 'center', transform: [{ rotate: '-3deg' }], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  ball: { position: 'absolute', left: '50%', top: 0, marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: color.ball, borderWidth: 2, borderColor: 'rgba(0,0,0,0.25)' },
  details: { marginTop: space.xl, alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', gap: space.md, width: '100%', maxWidth: 480 },
});
