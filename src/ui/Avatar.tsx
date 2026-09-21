// Initials with a colour from the name, so rows and cards have a face without photos.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { color } from '@/theme/tokens';

const PALETTE = ['#2E6FCB', '#1F5A34', '#D97A2B', '#7A3FB5', '#C7326B', '#0E8A8A'];
export function Avatar({ name, size = 40, ring }: { name: string; size?: number; ring?: boolean }) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  const bg = PALETTE[Math.abs(h) % PALETTE.length];
  return (
    <View style={[s.a, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, ring && s.ring]}>
      <T v="bodyM" tone="onCourt" style={{ fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: size * 0.42, lineHeight: size * 0.5 }}>{name.slice(0, 1).toUpperCase()}</T>
    </View>
  );
}
const s = StyleSheet.create({
  a: { alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  ring: { borderWidth: 3, borderColor: color.paper },
});
