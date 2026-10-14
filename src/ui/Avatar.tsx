// A player's face: their photo when they have given one, their initials when not. Always a
// circle, the shape people expect a face to be in.
import React from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { makeStyles } from '@/theme/theme';
import { fixed } from '@/theme/tokens';

export function initialsOf(name: string, lastInitial?: string | null) {
  const first = name.trim().slice(0, 1).toUpperCase();
  const last = (lastInitial ?? name.trim().split(/\s+/)[1] ?? '').slice(0, 1).toUpperCase();
  return (first + last) || '?';
}

export function Avatar({ name, lastInitial, photo, size = 46, ring, onDark, dot, style }:
  { name: string; lastInitial?: string | null; photo?: string | null; size?: number;
    // A thin ring, for faces that sit on a busy surface.
    ring?: boolean;
    // On the green player card: cream initials on a lighter green.
    onDark?: boolean;
    // The small green dot for someone looking to hit this week.
    dot?: boolean;
    style?: StyleProp<ViewStyle>;
    // Old prop, accepted and ignored: every face is round now.
    shape?: 'arch' | 'round' }) {
  const s = useS();
  const text = initialsOf(name, lastInitial);
  const r = { width: size, height: size, borderRadius: size / 2 };
  const d = Math.max(9, Math.round(size * 0.24));
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View style={[s.base, onDark ? s.dark : s.light, r, ring && (onDark ? s.ringDark : s.ring)]}
        accessible={!!photo} accessibilityRole={photo ? 'image' : undefined} accessibilityLabel={photo ? `${name}'s photo` : undefined}
        importantForAccessibility={photo ? 'yes' : 'no-hide-descendants'}>
        {photo
          ? <Image source={{ uri: photo }} style={r} />
          : <T v="h1" tone={onDark ? 'memberText' : 'ink'} style={{ fontSize: Math.round(size * 0.38), lineHeight: Math.round(size * 0.46), letterSpacing: -0.3 }}>{text}</T>}
      </View>
      {dot && <View style={[s.dot, { width: d, height: d, borderRadius: d / 2 }]} />}
    </View>
  );
}
const useS = makeStyles(c => ({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  light: { backgroundColor: c.avatar, borderWidth: 1, borderColor: c.avatarLine },
  dark: { backgroundColor: '#24513A', borderWidth: 1, borderColor: fixed.memberLine },
  ring: { borderWidth: 2, borderColor: c.card },
  ringDark: { borderWidth: 2, borderColor: fixed.memberText },
  // On a light face the yellow-green ball disappears; the brand green does not.
  dot: { position: 'absolute', right: 0, bottom: 0, backgroundColor: c.green, borderWidth: 2, borderColor: c.card },
}));
