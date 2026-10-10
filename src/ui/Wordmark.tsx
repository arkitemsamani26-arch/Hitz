// "Hits" and its dot. A plain heavy sans, set tight, with a 9px yellow-green ball on the
// baseline. Static: the logo does not move.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fixed, font } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

export function Wordmark({ size = 31, tone = 'ink' }: { size?: number; tone?: 'ink' | 'light' }) {
  const t = useTheme();
  const c = tone === 'light' ? fixed.memberText : t.ink;
  return (
    <View style={s.row} accessible accessibilityRole="header" accessibilityLabel="Hits">
      <Text style={[s.word, { fontSize: size, lineHeight: size, color: c }]} maxFontSizeMultiplier={1.2}>Hits</Text>
      <View style={s.dot} />
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  word: { fontFamily: font.wordmark, fontWeight: '800', letterSpacing: -1.8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: fixed.dot, borderWidth: 1, borderColor: fixed.dotLine, marginLeft: 3, marginBottom: 1 },
});
