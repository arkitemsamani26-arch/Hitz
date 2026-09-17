import React, { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { T } from './Text';
import { color, font, radius, space } from '@/theme/tokens';

export function Field({ label, big, style, onFocus, onBlur, ...rest }: TextInputProps & { label?: string; big?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      {label && <T v="micro" tone="ink3">{label}</T>}
      <TextInput
        placeholderTextColor={color.ink3}
        selectionColor={color.ball}
        cursorColor={color.ball}
        {...rest}
        onFocus={e => { setFocused(true); onFocus?.(e); }}
        onBlur={e => { setFocused(false); onBlur?.(e); }}
        style={[s.input, big && s.big, focused && s.focused, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any), style]}
      />
    </View>
  );
}
const s = StyleSheet.create({
  input: { backgroundColor: color.court2, borderWidth: 1.5, borderColor: color.line, borderRadius: radius.md, color: color.ink, paddingHorizontal: space.lg, minHeight: 56, fontSize: 18, fontFamily: font.medium },
  big: { fontSize: 32, fontFamily: font.black, letterSpacing: -0.5, minHeight: 72, textAlign: 'center' },
  focused: { borderColor: color.ball },
});
