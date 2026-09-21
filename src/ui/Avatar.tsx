// A face. The photo when there is one; initials in a colour from the name when not.
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { T } from './Text';
import { color } from '@/theme/tokens';
import { shadow } from '@/lib/shadow';

const PALETTE = ['#2E6FCB', '#1F5A34', '#D97A2B', '#7A3FB5', '#C7326B', '#0E8A8A'];
export function Avatar({ name, photo, size = 40, ring }: { name: string; photo?: string | null; size?: number; ring?: boolean }) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  const bg = PALETTE[Math.abs(h) % PALETTE.length];
  return (
    <View style={[s.a, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, ring && s.ring]}>
      {photo
        ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%', borderRadius: size / 2 }} accessibilityLabel={`${name}'s photo`} />
        : <T v="bodyM" tone="onCourt" style={{ fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: size * 0.42, lineHeight: size * 0.5 }}>{name.slice(0, 1).toUpperCase()}</T>}
    </View>
  );
}
const s = StyleSheet.create({
  a: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...shadow({ y: 3, blur: 8, opacity: 0.25, color: '#000000' }) },
  ring: { borderWidth: 3, borderColor: color.paper },
});
