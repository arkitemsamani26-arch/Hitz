// A monogram. The arch is the featured treatment: 46 wide, 53 tall, round on top and
// nearly square at the bottom. A photo, when a player has given one, is cropped the same.
import React from 'react';
import { Image, View } from 'react-native';
import { T } from './Text';
import { makeStyles } from '@/theme/theme';

export function initialsOf(name: string, lastInitial?: string | null) {
  const first = name.trim().slice(0, 1).toUpperCase();
  const last = (lastInitial ?? name.trim().split(/\s+/)[1] ?? '').slice(0, 1).toUpperCase();
  return (first + last) || '?';
}

export function Avatar({ name, lastInitial, photo, size = 46, shape = 'arch', ring }:
  { name: string; lastInitial?: string | null; photo?: string | null; size?: number; shape?: 'arch' | 'round'; ring?: boolean }) {
  const s = useS();
  const arch = shape === 'arch';
  const w = size, h = arch ? Math.round(size * 53 / 46) : size;
  const r = arch ? { borderTopLeftRadius: w / 2, borderTopRightRadius: w / 2, borderBottomLeftRadius: Math.round(w * 7 / 46), borderBottomRightRadius: Math.round(w * 7 / 46) } : { borderRadius: w / 2 };
  const text = initialsOf(name, lastInitial);
  return (
    <View style={[s.base, arch ? s.arch : s.round, { width: w, height: h }, r, ring && s.ring]}
      accessible={!!photo} accessibilityRole={photo ? 'image' : undefined} accessibilityLabel={photo ? `${name}'s photo` : undefined}
      importantForAccessibility={photo ? 'yes' : 'no-hide-descendants'}>
      {photo
        ? <Image source={{ uri: photo }} style={[{ width: '100%', height: '100%' }, r]} />
        : <T v="h1" style={{ fontSize: Math.round(size * (arch ? 19 : 13) / (arch ? 46 : 36)), lineHeight: Math.round(size * (arch ? 24 : 16) / (arch ? 46 : 36)) }}>{text}</T>}
    </View>
  );
}
const useS = makeStyles(c => ({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  arch: { backgroundColor: c.avatar, borderWidth: 1, borderColor: c.avatarLine },
  round: { backgroundColor: c.soft },
  ring: { borderWidth: 1, borderColor: c.line },
}));
