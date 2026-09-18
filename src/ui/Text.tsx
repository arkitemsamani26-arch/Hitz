import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { color, type } from '@/theme/tokens';

type Variant = keyof typeof type;
type Tone = 'ink' | 'ink2' | 'ink3' | 'ball' | 'court' | 'onCourt' | 'danger' | 'onBall' | 'ground';

export function T({ v = 'body', tone = 'ink', style, center, ...rest }: TextProps & { v?: Variant; tone?: Tone; center?: boolean }) {
  return (
    <RNText {...rest} maxFontSizeMultiplier={1.4}
      style={[type[v] as TextStyle, { color: color[tone] }, center && { textAlign: 'center' }, style]} />
  );
}
