// The level step is a self-assessment, not a form field. Pick the sentence that sounds
// like you; the number is ours to work out. Or type your UTR or NTRP straight in.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Icon } from '@/ui/Icon';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { useDraft } from '@/store/onboarding';
import type { LevelSource } from '@/data/types';

// USTA NTRP onto the UTR scale, midpoint of the usual overlap. Self-reported, so stored
// as 'utr_self'. The verified label only ever comes from a real UTR link.
const NTRP = [
  { n: '2.5', v: 1.8 }, { n: '3.0', v: 2.6 }, { n: '3.5', v: 3.6 }, { n: '4.0', v: 4.8 },
  { n: '4.5', v: 6.0 }, { n: '5.0', v: 7.5 }, { n: '5.5', v: 9.0 }, { n: '6.0+', v: 10.5 },
];

const LADDER: { label: string; sub: string; v: number }[] = [
  { label: 'Getting rallies going', sub: 'Still figuring it out. Here to play.', v: 2.0 },
  { label: 'I can hold a rally', sub: 'Strokes are there. Serve is coming.', v: 3.5 },
  { label: 'JV or club player', sub: 'You play weekly. You know the points.', v: 5.0 },
  { label: 'Varsity starter', sub: 'Real matches. Real weapons.', v: 6.5 },
  { label: 'Tournament player', sub: 'Sectionals, a ranking, a coach.', v: 8.0 },
  { label: 'College level', sub: 'Top juniors and college tennis.', v: 10.0 },
];

export default function Level() {
  const router = useRouter();
  const t = useTheme();
  const s = useS();
  const { draft, patch } = useDraft();
  const [v, setV] = useState<number | null>(draft.levelValue);
  const [src, setSrc] = useState<LevelSource | null>(draft.levelSource);
  const [mode, setMode] = useState<false | 'utr' | 'ntrp'>(draft.levelSource === 'utr_self' ? 'utr' : false);
  const [utrText, setUtrText] = useState(draft.levelValue ? String(draft.levelValue) : '');
  const go = () => { if (v == null || !src) return; patch({ levelValue: v, levelSource: src }); router.push('/onboarding/peek'); };

  // Typed straight in. Anything from 1 to 16.5 is a real UTR.
  const onUtr = (text: string) => {
    setUtrText(text);
    const n = parseFloat(text);
    if (!isNaN(n) && n >= 1 && n <= 16.5) { setV(n); setSrc('utr_self'); } else { setV(null); setSrc(null); }
  };

  return (
    <Screen scroll={false} bottom={<Centered><Button title="That's me" arrow onPress={go} disabled={v == null} /></Centered>}>
      <Centered>
        <View style={{ marginTop: space.lg, marginBottom: space.lg }}>
          <T v="eyebrow" tone="muted">Your level</T>
          <T v="display" style={{ marginTop: 12 }}>How do you{'\n'}<T v="display" italic>play?</T></T>
          <T v="small" tone="muted" style={{ marginTop: space.md, lineHeight: 21 }}>Pick the one that sounds like you. Self-reported for now; verify it from your club card later.</T>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.xl }}>
          {!mode && LADDER.map((l, i) => {
            const on = v === l.v && src === 'estimated';
            return (
              <Tap key={l.v} onPress={() => { setV(l.v); setSrc('estimated'); }} tick style={[s.opt, on && s.on]}
                accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on}>
                <View style={{ flex: 1 }}>
                  <T v="h2" tone={on ? 'greenText' : 'ink'} style={{ fontSize: 20, lineHeight: 24 }}>{l.label}</T>
                  <T v="meta" tone={on ? 'greenText' : 'muted'} style={{ marginTop: 2 }}>{l.sub}</T>
                  <View style={st.pips}>
                    {Array.from({ length: 6 }, (_, k) => <View key={k} style={[s.pip, k <= i && (on ? s.pipOnGreen : s.pipOn)]} />)}
                  </View>
                </View>
                {on && <Icon name="check" size={18} color={t.greenText} strokeWidth={2} />}
              </Tap>
            );
          })}

          {mode === 'ntrp' && (
            <Card style={{ gap: space.md }}>
              <T v="h2">Your NTRP</T>
              <T v="small" tone="muted">We line it up with the UTR scale. Just a starting point.</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {NTRP.map(x => <Button key={x.n} title={x.n} kind={v === x.v ? 'primary' : 'line'} small onPress={() => { setV(x.v); setSrc('utr_self'); }} />)}
              </View>
            </Card>
          )}

          {mode === 'utr' && (
            <Card style={{ gap: space.md }}>
              <T v="h2">Your UTR</T>
              <T v="small" tone="muted">Type it in. Close enough is fine.</T>
              <Field big value={utrText} onChangeText={onUtr} placeholder="8.5" keyboardType="decimal-pad" inputMode="decimal" autoFocus maxLength={5} accessibilityLabel="Your UTR rating" />
              <T v="meta" tone="muted" center>Get it verified from your club card once you're in. Verified ratings carry the label.</T>
            </Card>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg, flexWrap: 'wrap' }}>
            {mode ? (
              <Tap onPress={() => { setMode(false); setV(null); setSrc(null); setUtrText(''); }} style={st.link} tick accessibilityRole="button">
                <T v="smallM" tone="green">Back to the list</T>
              </Tap>
            ) : (<>
              <Tap onPress={() => { setMode('utr'); }} style={st.link} tick accessibilityRole="button"><T v="smallM" tone="green">I know my UTR</T></Tap>
              <Tap onPress={() => { setMode('ntrp'); }} style={st.link} tick accessibilityRole="button"><T v="smallM" tone="green">I know my NTRP</T></Tap>
            </>)}
          </View>
        </ScrollView>
      </Centered>
    </Screen>
  );
}

const st = StyleSheet.create({
  pips: { flexDirection: 'row', gap: 5, marginTop: space.md },
  link: { minHeight: hit.min, justifyContent: 'center', alignItems: 'center' },
});
const useS = makeStyles(c => ({
  opt: { minHeight: hit.row + 16, padding: 17, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, flexDirection: 'row', alignItems: 'center', gap: space.md },
  on: { backgroundColor: c.green, borderColor: c.green },
  pip: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.line },
  pipOn: { backgroundColor: c.green },
  pipOnGreen: { backgroundColor: c.greenText },
}));
