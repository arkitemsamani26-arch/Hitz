// The level step is a self-assessment, not a form field. Pick the sentence that sounds
// like you; the number follows.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Score } from '@/ui/Score';
import { color, hit, radius, space } from '@/theme/tokens';
import { Sheet } from '@/ui/Screen';
import { useDraft } from '@/store/onboarding';
import type { LevelSource } from '@/data/types';

// USTA NTRP to the UTR scale, midpoint of the usual overlap. Self-reported, so stored as
// 'utr_self' -- the verified badge only comes from a real UTR link.
const NTRP: { n: string; v: number }[] = [
  { n: '2.5', v: 1.8 }, { n: '3.0', v: 2.6 }, { n: '3.5', v: 3.6 }, { n: '4.0', v: 4.8 }, { n: '4.5', v: 6.0 }, { n: '5.0', v: 7.5 }, { n: '5.5', v: 9.0 }, { n: '6.0+', v: 10.5 },
];
const LADDER: { label: string; sub: string; v: number }[] = [
  { label: 'Getting rallies going', sub: 'Newer to the game, working on consistency', v: 2.0 },
  { label: 'I can hold a rally', sub: 'Solid strokes, serve is a work in progress', v: 3.5 },
  { label: 'JV / club player', sub: 'Play regularly, know how to construct a point', v: 5.0 },
  { label: 'Varsity starter', sub: 'Competitive matches, real weapons', v: 6.5 },
  { label: 'Tournament player', sub: 'Sectionals, a ranking, a coach', v: 8.0 },
  { label: 'National / college level', sub: 'D1–D3 or top-tier juniors', v: 10.0 },
];

export default function Level() {
  const router = useRouter();
  const { draft, patch } = useDraft();
  const [v, setV] = useState<number | null>(draft.levelValue);
  const [src, setSrc] = useState<LevelSource | null>(draft.levelSource);
  const [knows, setKnows] = useState<false | 'utr' | 'ntrp'>(draft.levelSource === 'utr_self' ? 'utr' : false);
  const go = () => { if (v == null || !src) return; patch({ levelValue: v, levelSource: src }); router.push('/onboarding/peek'); };
  const step = (d: number) => { setV(x => Math.min(16.5, Math.max(1, +((x ?? 6) + d).toFixed(2)))); setSrc('utr_self'); };
  return (
    <Screen scroll={false} sky={140} bottom={<Centered><Button title="That's me" kind="ball" onPress={go} disabled={v == null} /></Centered>}>
      <Centered>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <T v="h1">How do you play?</T>
            <T v="small" tone="ink2" style={{ marginTop: 4 }}>Pick the one that sounds like you.</T>
          </View>
          <View style={s.badge}><Score value={v} size="score" tone={v == null ? 'ink' : 'court'} /></View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.xl }}>
          {!knows && LADDER.map(l => {
            const on = v === l.v && src === 'estimated';
            return (
              <Tap key={l.v} onPress={() => { setV(l.v); setSrc('estimated'); }} tick style={[s.opt, on && s.on]} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on}>
                <View style={{ flex: 1 }}>
                  <T v="bodyM" tone="ink">{l.label}</T>
                  <T v="small" tone="ink2">{l.sub}</T>
                </View>
                <T v="h2" tone={on ? 'ink' : 'ink3'}>{l.v.toFixed(1)}</T>
              </Tap>
            );
          })}
          {knows === 'ntrp' && (
            <View style={s.stepper}>
              <T v="small" tone="ink2" center style={{ marginBottom: space.md }}>Your USTA NTRP. We map it onto the UTR scale as a starting point.</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' }}>
                {NTRP.map(x => <Button key={x.n} title={x.n} kind={v === x.v ? 'ball' : 'line'} small onPress={() => { setV(x.v); setSrc('utr_self'); }} />)}
              </View>
            </View>
          )}
          {knows === 'utr' && (
            <View style={s.stepper}>
              <T v="small" tone="ink2" center style={{ marginBottom: space.md }}>Your UTR. Close enough is fine — this isn't a rating, it's a starting point.</T>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.md }}>
                <Button title="−0.5" kind="line" onPress={() => step(-0.5)} small />
                <Button title="−0.1" kind="line" onPress={() => step(-0.1)} small />
                <Button title="+0.1" kind="line" onPress={() => step(0.1)} small />
                <Button title="+0.5" kind="line" onPress={() => step(0.5)} small />
              </View>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg }}>
            {knows ? (
              <Tap onPress={() => { setKnows(false); setV(null); setSrc(null); }} style={s.link} tick><T v="smallM" tone="onCourt">← Back to the list</T></Tap>
            ) : (<>
              <Tap onPress={() => { setKnows('utr'); setSrc('utr_self'); setV(x => x ?? 6.0); }} style={s.link} tick><T v="smallM" tone="onCourt">I know my UTR →</T></Tap>
              <Tap onPress={() => { setKnows('ntrp'); }} style={s.link} tick><T v="smallM" tone="onCourt">I know my NTRP →</T></Tap>
            </>)}
          </View>
        </ScrollView>
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg, marginTop: space.lg, marginBottom: space.xl },
  opt: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: hit.row, padding: space.lg, borderRadius: radius.md, backgroundColor: color.paper },
  on: { backgroundColor: color.ball },
  stepper: { padding: space.lg, borderRadius: radius.md, backgroundColor: color.paper },
  badge: { backgroundColor: color.paper, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 4 },
  link: { minHeight: hit.min, justifyContent: 'center', alignItems: 'center' },
});
