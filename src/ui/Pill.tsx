import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { Icon, type IconName } from './Icon';
import { hit, radius } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';

type Tone = 'line' | 'soft' | 'green' | 'ball' | 'court' | 'faint' | 'white';

// Two things, one component. With onPress it is a choice chip: bordered, 44 tall, green
// when chosen. Without, it is a status label on the soft surface.
export function Pill({ label, tone = 'line', style, on, onPress, icon }:
  { label: string; tone?: Tone; style?: StyleProp<ViewStyle>; on?: boolean; onPress?: () => void; icon?: IconName }) {
  const t = useTheme();
  const s = useS();
  const chosen = on || tone === 'green' || tone === 'ball' || tone === 'court';
  const fg = chosen ? t.greenText : t.ink;
  if (!onPress) {
    return (
      <View style={[s.status, chosen && s.on, style]}>
        {icon && <Icon name={icon} size={13} color={fg} />}
        <T v="meta" style={{ color: fg }}>{label}</T>
      </View>
    );
  }
  return (
    <Tap onPress={onPress} tick accessibilityRole={on === undefined ? 'button' : 'checkbox'} accessibilityState={on === undefined ? undefined : { checked: !!on }} aria-checked={on === undefined ? undefined : !!on}
      style={[s.chip, chosen && s.on, style]}>
      {icon && <Icon name={icon} size={14} color={fg} />}
      <T v="small" style={{ color: fg }}>{label}</T>
    </Tap>
  );
}
const useS = makeStyles(c => ({
  chip: { minHeight: hit.min, paddingVertical: 9, paddingHorizontal: 13, borderRadius: radius.sm, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center' },
  status: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: radius.xs, backgroundColor: c.soft, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  on: { backgroundColor: c.green, borderColor: c.green },
}));
