// The plan panel: 19px inside, groups separated by fine rules, each a small label over a
// 15px value, with a note underneath where honesty needs one.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { radius } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { shadow } from '@/lib/shadow';

export type PlanGroup = { label?: string; values: string[]; note?: string; onPress?: () => void; editLabel?: string };

export function PlanPanel({ groups, style, children }: { groups: PlanGroup[]; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const t = useTheme();
  const s = useS();
  return (
    <View style={[s.panel, style]}>
      {groups.map((g, i) => {
        const body = (
          <View style={{ flex: 1, minWidth: 0 }}>
            {g.label && <T v="micro" tone="muted" style={st.label}>{g.label}</T>}
            {g.values.map((v, j) => <T key={j} v="bodyM">{v}</T>)}
            {g.note && <T v="meta" tone="muted" style={st.note}>{g.note}</T>}
          </View>
        );
        return (
          <View key={i}>
            {i > 0 && <View style={s.rule} />}
            {g.onPress
              ? <Tap onPress={g.onPress} style={st.editRow} accessibilityRole="button" accessibilityLabel={g.editLabel ?? `Change ${g.label?.toLowerCase() ?? 'this'}`}>
                  {body}
                  <View style={s.edit}><Icon name="pencil" size={15} color={t.ink} /></View>
                </Tap>
              : body}
          </View>
        );
      })}
      {children}
    </View>
  );
}
const st = StyleSheet.create({
  label: { marginBottom: 7, letterSpacing: 1.3 },
  note: { marginTop: 12, lineHeight: 18 },
  editRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
const useS = makeStyles(c => ({
  panel: { padding: 19, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: radius.lg, ...shadow({ y: 7, blur: 14, color: c.shadow, opacity: 0.035 }) },
  rule: { height: 1, backgroundColor: c.line, marginVertical: 17 },
  edit: { width: 36, height: 36, borderRadius: 8, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center', marginTop: -6, marginRight: -6 },
}));
