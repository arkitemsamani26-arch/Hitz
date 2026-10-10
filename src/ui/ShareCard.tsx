// A story-sized card for a confirmed hit, in the member card's green. Rendered off-screen
// and captured to an image on device; on web it falls back to sharing the text.
import React, { forwardRef } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Wordmark } from './Wordmark';
import { Court } from './CourtArt';
import { fixed } from '@/theme/tokens';
import { dateLong, rangeText } from '@/lib/format';
import type { HitRequest, Profile } from '@/data/types';

export const ShareCard = forwardRef<View, { req: HitRequest; me: Profile }>(function ShareCard({ req, me }, ref) {
  const start = new Date(req.windowStart), end = new Date(req.windowEnd);
  return (
    <View ref={ref} collapsable={false} style={s.card}>
      <View style={s.art} pointerEvents="none"><Court width={420} height={780} color={fixed.art} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Wordmark size={90} tone="light" />
        <T v="eyebrow" tone="memberMeta" style={{ fontSize: 28, lineHeight: 36, letterSpacing: 5 }}>Hit</T>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <T v="hero" tone="memberText" style={{ fontSize: 150, lineHeight: 156, letterSpacing: -5 }}>It's on.</T>
        <T v="h1" tone="memberMeta" style={{ fontSize: 52, lineHeight: 62, marginTop: 30 }}>{me.displayName} and {req.other.displayName}</T>
      </View>
      <View style={s.bottom}>
        <T v="eyebrow" tone="memberMeta" style={{ fontSize: 28, lineHeight: 36, letterSpacing: 5 }}>{dateLong(start)}</T>
        <T v="h1" tone="memberText" style={{ fontSize: 64, lineHeight: 74, marginTop: 10 }}>{rangeText(start, end)}</T>
        <T v="body" tone="memberMeta" style={{ fontSize: 40, lineHeight: 52, marginTop: 10 }}>{req.courtName}</T>
      </View>
    </View>
  );
});

export async function shareMoment(node: React.RefObject<View | null>, req: HitRequest, me: Profile) {
  const start = new Date(req.windowStart), end = new Date(req.windowEnd);
  const text = `It's on. ${me.displayName} and ${req.other.displayName} · ${dateLong(start)}, ${rangeText(start, end)} · ${req.courtName}`;
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
  card: { position: 'absolute', left: -4000, top: 0, width: 1080, height: 1920, backgroundColor: fixed.member, padding: 90, overflow: 'hidden' },
  art: { position: 'absolute', right: -60, top: 300, opacity: 0.65 },
  bottom: { borderTopWidth: 2, borderTopColor: fixed.memberRule, paddingTop: 40 },
});
