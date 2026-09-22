// A story-sized card for the confirmed moment. Rendered off-screen at 1080x1920 and
// captured to an image on device; on web it falls back to sharing the text.
import React, { forwardRef } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from './Text';
import { Avatar } from './Avatar';
import { CourtSurface } from './Court';
import { color } from '@/theme/tokens';
import { levelBig, windowShout } from '@/lib/format';
import type { HitRequest, Profile } from '@/data/types';
import { textShadow } from '@/lib/shadow';

export const ShareCard = forwardRef<View, { req: HitRequest; me: Profile }>(function ShareCard({ req, me }, ref) {
  const start = new Date(req.windowStart);
  return (
    <View ref={ref} collapsable={false} style={s.card}>
      <LinearGradient colors={['#8EC5FF', '#BFE3FF', '#2E7A45']} locations={[0, 0.35, 0.36]} style={StyleSheet.absoluteFill} />
      <View style={s.top}>
        <T v="display" style={{ fontSize: 96, lineHeight: 100, letterSpacing: -4 }}>Hits</T>
        <T v="h1" tone="ink2">Palo Alto</T>
      </View>
      <CourtSurface style={s.court}>
        <View style={[s.side, { top: 90 }]}>
          <Avatar name={req.other.displayName} photo={req.other.photoUrl} size={140} ring />
          <T v="score" tone="ball" style={s.num}>{levelBig(req.other.levelValue)}</T>
          <T v="h1" tone="onCourt">{req.other.displayName}</T>
        </View>
        <View style={s.banner}><T v="display" tone="onBall" style={{ fontSize: 110, lineHeight: 116 }}>IT'S ON.</T></View>
        <View style={[s.side, { bottom: 90 }]}>
          <T v="h1" tone="onCourt">{me.displayName}</T>
          <T v="score" tone="ball" style={s.num}>{levelBig(me.levelValue)}</T>
          <Avatar name={me.displayName} photo={me.photoUrl} size={140} ring />
        </View>
      </CourtSurface>
      <View style={s.foot}>
        <T v="display" tone="onCourt" style={{ fontSize: 72, lineHeight: 76 }}>{windowShout(start)}</T>
        <T v="h1" tone="onCourt" style={{ opacity: 0.9 }}>{req.courtName}</T>
      </View>
    </View>
  );
});

export async function shareMoment(node: React.RefObject<View | null>, req: HitRequest, me: Profile) {
  const text = `It's on. ${me.displayName} vs ${req.other.displayName} · ${windowShout(new Date(req.windowStart))} · ${req.courtName}`;
  if (Platform.OS === 'web' || !node.current) { await Share.share({ message: text }).catch(() => {}); return; }
  try {
    const { captureRef } = require('react-native-view-shot');
    const Sharing = require('expo-sharing');
    const uri: string = await captureRef(node, { format: 'png', quality: 1, width: 1080, height: 1920 });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: text });
    else await Share.share({ message: text, url: uri });
  } catch { await Share.share({ message: text }).catch(() => {}); }
}

const s = StyleSheet.create({
  card: { position: 'absolute', left: -4000, top: 0, width: 1080, height: 1920, backgroundColor: color.ground, padding: 80, alignItems: 'center' },
  top: { alignItems: 'center', marginTop: 40 },
  court: { width: 780, height: 1120, marginTop: 60 },
  side: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 8 },
  num: { fontSize: 160, lineHeight: 164, letterSpacing: -8, ...textShadow({ y: 6, color: 'rgba(0,0,0,0.3)' }) },
  banner: { position: 'absolute', left: -40, right: -40, top: '50%', marginTop: -70, backgroundColor: color.ball, paddingVertical: 12, alignItems: 'center', transform: [{ rotate: '-3deg' }] },
  foot: { alignItems: 'center', marginTop: 50 },
});
