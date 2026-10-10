import React, { useState } from 'react';
import { Platform, TextInput, View, type TextInputProps } from 'react-native';
import { T } from './Text';
import { font, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';

export function Field({ label, big, style, onFocus, onBlur, ...rest }: TextInputProps & { label?: string; big?: boolean }) {
  const t = useTheme();
  const s = useS();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      {label && <T v="micro" tone="muted">{label}</T>}
      <TextInput placeholderTextColor={t.muted} selectionColor={t.green} cursorColor={t.green} {...rest}
        onFocus={e => { setFocused(true); onFocus?.(e); }} onBlur={e => { setFocused(false); onBlur?.(e); }}
        style={[s.input, big && s.big, focused && s.focused, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any), style]} />
    </View>
  );
}
const useS = makeStyles(c => ({
  input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, color: c.ink, paddingHorizontal: 14, paddingVertical: 12, minHeight: 50, fontSize: 16, fontFamily: font.regular },
  big: { fontSize: 30, fontFamily: font.serif, letterSpacing: -0.6, minHeight: 64, textAlign: 'center' },
  focused: { borderColor: c.green, borderWidth: 1.5 },
}));
