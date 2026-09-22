// An anonymous read of a cohort: how many players sit around your level, without naming
// one of them. Used on the peek screen, which runs before a profile exists and therefore
// before anyone is allowed to see who is out there.
//
// Each ball is a player, placed by how far their level is from yours. Yours is the yellow
// one on the net line. No names, no distances, no identities -- the count is the only
// fact, and it is a true one.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { CourtSurface } from './Court';
import { T } from './Text';
import { color, space } from '@/theme/tokens';
import { shadow } from '@/lib/shadow';
import { useMotion } from '@/lib/motion';

// Deterministic jitter, so the same cohort draws the same way every time instead of
// reshuffling on each render.
function spot(i: number, n: number) {
  const golden = 0.6180339887;
  const t = ((i + 1) * golden) % 1;
  // Closer to the net means closer to your level, and most of a cohort is close.
  const depth = Math.pow((i + 0.5) / n, 0.7);
  return { x: 0.16 + t * 0.68, y: 0.44 - depth * 0.34 };
}

function Dot({ i, n, delay }: { i: number; n: number; delay: number }) {
  const { reduced } = useMotion();
  const a = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { a.value = 1; return; }
    a.value = withDelay(delay, withSpring(1, { damping: 13, stiffness: 180 }));
  }, [a, delay, reduced]);
  const p = spot(i, n);
  const st = useAnimatedStyle(() => ({ opacity: a.value, transform: [{ scale: a.value }] }));
  return <Animated.View style={[s.dot, { left: `${p.x * 100}%`, top: `${p.y * 100}%` }, st]} pointerEvents="none" />;
}

export function Ladder({ count, label }: { count: number; label: string }) {
  const { reduced } = useMotion();
  // A dozen balls reads as "a crowd"; three hundred would read as noise.
  const n = Math.min(12, Math.max(0, count));
  const you = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { you.value = 1; return; }
    you.value = withDelay(120, withSpring(1, { damping: 11, stiffness: 200 }));
  }, [you, reduced]);
  const pulse = useSharedValue(0);
  useEffect(() => { pulse.value = withTiming(1, { duration: 1400 }); }, [pulse]);
  const yourStyle = useAnimatedStyle(() => ({ opacity: you.value, transform: [{ scale: you.value }] }));

  return (
    <View style={{ alignItems: 'center' }} accessibilityLabel={`${count} ${label} around your level`}>
      <CourtSurface style={s.court} dim>
        {Array.from({ length: n }, (_, i) => <Dot key={i} i={i} n={n} delay={220 + i * 55} />)}
        <Animated.View style={[s.you, yourStyle]} pointerEvents="none">
          <View style={s.youBall} />
          <T v="micro" tone="onCourt" style={{ marginTop: 4 }}>you</T>
        </Animated.View>
      </CourtSurface>
      <T v="small" tone="onCourt" center style={{ marginTop: space.md, opacity: 0.9 }}>
        {n === 0 ? 'The court fills up as players join.' : 'Closer to the net, closer to your level.'}
      </T>
    </View>
  );
}

const s = StyleSheet.create({
  court: { width: '100%', maxWidth: 340, aspectRatio: 0.78 },
  dot: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8, marginLeft: -8, marginTop: -8,
    backgroundColor: color.paper, borderWidth: 1.5, borderColor: 'rgba(14,27,51,0.35)',
    ...shadow({ y: 2, blur: 5, opacity: 0.25, color: '#000000' }),
  },
  you: { position: 'absolute', left: '50%', bottom: '11%', marginLeft: -18, width: 36, alignItems: 'center' },
  youBall: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: color.ball,
    borderWidth: 2, borderColor: 'rgba(14,27,51,0.35)', ...shadow({ y: 3, blur: 8, opacity: 0.3, color: '#000000' }),
  },
});
