// The court is the canvas. A top-down hard court with white lines; players sit on it.
import React from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { T } from './Text';
import { Tap } from './Tap';
import { color } from '@/theme/tokens';
import { spring } from '@/lib/motion';
import type { Player } from '@/data/types';

// Court geometry, as fractions of the drawn rectangle (doubles court, portrait).
const SIDE = 0.11;       // doubles alley width
const SERVICE = 0.26;    // service line from each baseline

export function CourtSurface({ style, children, dim, onLayout }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode; dim?: boolean; onLayout?: (e: LayoutChangeEvent) => void }) {
  return (
    <View style={[s.court, dim && { opacity: 0.85 }, style]} onLayout={onLayout}>
      <View style={[s.vline, { left: `${SIDE * 100}%` }]} />
      <View style={[s.vline, { right: `${SIDE * 100}%` }]} />
      <View style={[s.hline, { top: `${SERVICE * 100}%`, left: `${SIDE * 100}%`, right: `${SIDE * 100}%` }]} />
      <View style={[s.hline, { bottom: `${SERVICE * 100}%`, left: `${SIDE * 100}%`, right: `${SIDE * 100}%` }]} />
      <View style={[s.vline, { left: '50%', top: `${SERVICE * 100}%`, bottom: `${SERVICE * 100}%`, marginLeft: -1.5 }]} />
      <View style={s.net} />
      <View style={[s.mark, { top: 0 }]} /><View style={[s.mark, { bottom: 0 }]} />
      {children}
    </View>
  );
}

// Level delta -> depth on the far side (net = closest in level). Distance -> spread.
export function place(p: Player, i: number, radiusMi: number): { x: number; y: number } {
  const delta = Math.min(2.5, p.levelDelta ?? 1.5);
  const y = 0.44 - (delta / 2.5) * 0.38;                     // 0.44 at the net, 0.06 at the baseline
  const mi = parseMiles(p.distanceBucket);
  const spread = Math.min(1, mi / Math.max(1, radiusMi));
  const side = i % 2 === 0 ? -1 : 1;
  const x = 0.5 + side * (0.10 + spread * 0.30) + ((i % 3) - 1) * 0.04;
  return { x, y: y - ((i >> 1) % 2) * 0.045 };
}
export function parseMiles(b: string | null): number {
  if (!b) return 5; const m = b.match(/(\d+)/); return b.startsWith('under') ? 0.5 : m ? +m[1] : 5;
}

export function Token({ p, x, y, onPress, hot, delay = 0, above }: { p: Player; x: number; y: number; onPress: () => void; hot?: boolean; delay?: number; above?: boolean }) {
  return (
    <Animated.View entering={FadeIn.delay(delay).springify().damping(spring.land.damping).stiffness(spring.land.stiffness)}
      style={[s.tokWrap, { left: `${x * 100}%`, top: `${y * 100}%` }, above && s.tokWrapAbove]} pointerEvents="box-none">
      {above && <T v="micro" tone="onCourt" style={s.tokLabel} numberOfLines={1}>{p.displayName} · {p.distanceBucket?.replace('~', '') ?? ''}</T>}
      <Tap onPress={onPress} tick scaleTo={0.9} style={[s.tok, hot && s.tokHot]} accessibilityRole="button" accessibilityLabel={`${p.displayName}, level ${p.levelValue}`}>
        <T v="smallM" tone="ink" style={{ fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 15 }}>{p.levelValue?.toFixed(1)}</T>
      </Tap>
      {!above && <T v="micro" tone="onCourt" style={s.tokLabel} numberOfLines={1}>{p.displayName} · {p.distanceBucket?.replace('~', '') ?? ''}</T>}
    </Animated.View>
  );
}

export function You({ level }: { level: number | null }) {
  return (
    <View style={s.youWrap} pointerEvents="none">
      <T v="micro" tone="onCourt" style={{ marginBottom: 4 }}>You · {level?.toFixed(1) ?? '–'}</T>
      <View style={s.you} />
    </View>
  );
}

const s = StyleSheet.create({
  court: { backgroundColor: color.court, borderWidth: 3, borderColor: color.line, borderRadius: 3, overflow: 'visible' },
  vline: { position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: color.line },
  hline: { position: 'absolute', height: 3, backgroundColor: color.line },
  net: { position: 'absolute', left: -6, right: -6, top: '50%', height: 4, marginTop: -2, backgroundColor: color.line, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 2 } },
  mark: { position: 'absolute', left: '50%', width: 3, height: 8, marginLeft: -1.5, backgroundColor: color.line },
  tokWrap: { position: 'absolute', width: 120, height: 74, marginLeft: -60, marginTop: -23, alignItems: 'center' },
  tokWrapAbove: { marginTop: -51, justifyContent: 'flex-end' },
  tok: { width: 46, height: 46, borderRadius: 23, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  tokHot: { backgroundColor: color.ball },
  tokLabel: { marginVertical: 4, width: 120, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  youWrap: { position: 'absolute', bottom: 12, left: 0, right: 0, alignItems: 'center' },
  you: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.ball, borderWidth: 3, borderColor: color.paper, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
});
