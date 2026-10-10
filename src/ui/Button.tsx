import React from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { Icon, type IconName } from './Icon';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';

// primary: the dark-green strip. line: a bordered card. soft: the selected surface.
// ghost: words. danger: the one for leaving.
type Kind = 'primary' | 'line' | 'soft' | 'ghost' | 'danger' | 'court' | 'ball' | 'white';

export function Button({ title, onPress, kind = 'primary', disabled, loading, style, small, arrow, icon }:
  { title: string; onPress?: () => void; kind?: Kind; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
    // The up-right arrow on the primary actions of the reference.
    arrow?: boolean; icon?: IconName }) {
  const t = useTheme();
  const s = useS();
  const k: Exclude<Kind, 'court' | 'ball' | 'white'> = kind === 'court' || kind === 'ball' ? 'primary' : kind === 'white' ? 'line' : kind;
  const off = disabled || loading;
  const fg = k === 'primary' ? t.greenText : k === 'danger' ? t.danger : k === 'ghost' ? t.muted : t.ink;
  const glyph: IconName | null = arrow ? 'arrow-up-right' : icon ?? null;
  return (
    <Tap onPress={onPress} disabled={off} accessibilityRole="button" accessibilityState={{ disabled: off }}
      style={[s.base, s[k], small && s.small, glyph && s.spread, off && s.off, style]}>
      {loading ? <ActivityIndicator color={fg} />
        : <>
            <T v="smallM" style={{ color: fg, flexShrink: 1 }}>{title}</T>
            {glyph && <Icon name={glyph} size={17} color={fg} />}
          </>}
    </Tap>
  );
}
const useS = makeStyles(c => ({
  base: { minHeight: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 17, flexDirection: 'row', gap: 10 },
  small: { minHeight: hit.min, paddingVertical: 9, paddingHorizontal: 13, borderRadius: radius.sm },
  spread: { justifyContent: 'space-between' },
  primary: { backgroundColor: c.green },
  line: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  soft: { backgroundColor: c.soft },
  ghost: { backgroundColor: 'transparent', paddingHorizontal: space.sm },
  danger: { backgroundColor: c.dangerSoft },
  off: { opacity: 0.5 },
}));
