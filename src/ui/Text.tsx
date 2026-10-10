import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { fixed, font, type } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

type Variant = keyof typeof type;
export type Tone =
  | 'ink' | 'muted' | 'green' | 'greenText' | 'danger'
  | 'heroText' | 'heroEm' | 'heroEyebrow' | 'heroCopy' | 'memberText' | 'memberMeta'
  // Old names, kept so a screen that has not been touched still reads.
  | 'ink2' | 'ink3' | 'ball' | 'court' | 'onCourt' | 'onBall' | 'ground';

const SERIF: Variant[] = ['hero', 'display', 'score', 'rating', 'h1', 'h2'];

export function T({ v = 'body', tone = 'ink', italic, style, center, ...rest }:
  TextProps & { v?: Variant; tone?: Tone; italic?: boolean; center?: boolean }) {
  const t = useTheme();
  const c: Record<Tone, string> = {
    ink: t.ink, muted: t.muted, green: t.green, greenText: t.greenText, danger: t.danger,
    heroText: fixed.heroText, heroEm: fixed.heroEm, heroEyebrow: fixed.heroEyebrow, heroCopy: fixed.heroCopy,
    memberText: fixed.memberText, memberMeta: fixed.memberMeta,
    ink2: t.muted, ink3: t.muted, ball: t.green, court: t.green, onCourt: t.greenText, onBall: t.greenText, ground: t.green,
  };
  // Headings scale less than body text under large type settings, or a 44px hero at 1.4x
  // runs off a narrow phone. Body text goes up to 1.5x.
  return (
    <RNText {...rest} maxFontSizeMultiplier={SERIF.includes(v) ? 1.2 : 1.5}
      style={[type[v] as TextStyle, { color: c[tone] }, italic && SERIF.includes(v) && { fontFamily: font.serifItalic }, center && { textAlign: 'center' }, style]} />
  );
}
