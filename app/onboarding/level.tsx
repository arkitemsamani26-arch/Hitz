// The level step is a self-assessment, not a form field. Pick the sentence that sounds
// like you. No raw numbers on the card: a row of balls shows the step, the number is
// ours to work out.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Pop } from '@/ui/Pop';
import { color, hit, radius, space } from '@/theme/tokens';
import { useDraft } from '@/store/onboarding';
import type { LevelSource } from '@/data/types';

// USTA NTRP onto the UTR scale, midpoint of the usual overlap. Self-reported, so stored
// as 'utr_self'. The verified badge only ever comes from a real UTR link.
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
  const { draft, patch } = useDraft();
  const [v, setV] = useState<number | null>(draft.levelValue);
  const [src, setSrc] = useState<LevelSource | null>(draft.levelSource);
  const [mode, setMode] = useState<false | 'utr' | 'ntrp'>(draft.levelSource === 'utr_self' ? 'utr' : false);
  const [utrText, setUtrText] = useState(draft.levelValue ? String(draft.levelValue) : '');
  const go = () => { if (v == null || !src) return; patch({ levelValue: v, levelSource: src }); router.push('/onboarding/peek'); };

  // Typed straight in. Anything from 1 to 16.5 is a real UTR.
  const onUtr = (t: string) => {
    setUtrText(t);
    const n = parseFloat(t);
    if (!isNaN(n) && n >= 1 && n <= 16.5) { setV(n); setSrc('utr_self'); } else { setV(null); setSrc(null); }
  };

  return (
    <Screen scroll={false} sky={150} bottom={<Centered><Button title="That's me" kind="ball" onPress={go} disabled={v == null} /></Centered>}>
      <Centered>
        <View style={{ marginTop: space.lg, marginBottom: space.lg }}>
          <T v="display">How do you play?</T>
          <T v="body" tone="ink2" style={{ marginTop: 4 }}>Pick the one that sounds like you.</T>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingBottom: space.xl }}>
          {!mode && LADDER.map((l, i) => {
            const on = v === l.v && src === 'estimated';
            return (
              <Pop key={l.v} on={on}>
                <Tap onPress={() => { setV(l.v); setSrc('estimated'); }} tick style={[s.opt, on && s.on]}
                  accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on}>
                  <View style={{ flex: 1 }}>
                    <T v="h2" tone="ink" style={{ fontSize: 21, lineHeight: 25 }}>{l.label}</T>
                    <T v="small" tone={on ? 'ink' : 'ink2'} style={[{ marginTop: 2 }, on && { opacity: 0.75 }]}>{l.sub}</T>
                    <View style={s.balls}>
                      {Array.from({ length: 6 }, (_, k) => (
                        <View key={k} style={[s.pip, k <= i && (on ? s.pipOnBall : s.pipOn)]} />
                      ))}
                    </View>
                  </View>
                </Tap>
              </Pop>
            );
          })}

          {mode === 'ntrp' && (
            <Sheet style={{ gap: space.md }}>
              <T v="h2">Your NTRP</T>
              <T v="small" tone="ink2">We line it up with the UTR scale. Just a starting point.</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {NTRP.map(x => <Button key={x.n} title={x.n} kind={v === x.v ? 'ball' : 'line'} small onPress={() => { setV(x.v); setSrc('utr_self'); }} />)}
              </View>
            </Sheet>
          )}

          {mode === 'utr' && (
            <Sheet style={{ gap: space.md }}>
              <T v="h2">Your UTR</T>
              <T v="small" tone="ink2">Type it in. Close enough is fine.</T>
              <Field big value={utrText} onChangeText={onUtr} placeholder="8.5" keyboardType="decimal-pad" inputMode="decimal" autoFocus maxLength={5} accessibilityLabel="Your UTR rating" />
              <T v="small" tone="ink3" center>Get it verified from your profile once you're in. Verified levels carry the badge.</T>
            </Sheet>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg, flexWrap: 'wrap' }}>
            {mode ? (
              <Tap onPress={() => { setMode(false); setV(null); setSrc(null); setUtrText(''); }} style={s.link} tick>
                <T v="smallM" tone="onCourt">Back to the list</T>
              </Tap>
            ) : (<>
              <Tap onPress={() => { setMode('utr'); }} style={s.link} tick><T v="smallM" tone="onCourt">I know my UTR</T></Tap>
              <Tap onPress={() => { setMode('ntrp'); }} style={s.link} tick><T v="smallM" tone="onCourt">I know my NTRP</T></Tap>
            </>)}
          </View>
        </ScrollView>
      </Centered>
    </Screen>
  );
}

const s = StyleSheet.create({
  opt: { minHeight: hit.row + 16, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.paper },
  on: { backgroundColor: color.ball },
  balls: { flexDirection: 'row', gap: 5, marginTop: space.md },
  pip: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.paper3 },
  pipOn: { backgroundColor: color.court },
  pipOnBall: { backgroundColor: color.ink },
  link: { minHeight: hit.min, justifyContent: 'center', alignItems: 'center' },
});
