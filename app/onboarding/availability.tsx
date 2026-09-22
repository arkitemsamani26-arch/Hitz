// When you play. Rough is fine: exact times get picked per hit.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pop } from '@/ui/Pop';
import { color, radius, space } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft, isMinor } from '@/store/onboarding';
import { useSession } from '@/store/session';
import { SLOTS } from '@/data/types';
import { flushLocation } from '@/lib/location';

const ALL = SLOTS.reduce((m, s) => m | s.bit, 0);

export default function Availability() {
  const router = useRouter();
  const { draft, patch } = useDraft();
  const { setProfile } = useSession();
  const [mask, setMask] = useState(draft.availabilityMask);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (b: number) => setMask(m => m ^ b);
  const flexible = mask === ALL;

  const finish = async (m: number) => {
    // The draft lives in memory. A deep link or a web reload can land here with half of
    // it missing, and sending nulls made a minor look like an adult.
    if (!draft.dateOfBirth || draft.levelValue == null || !draft.levelSource || !draft.homeCourtId) {
      setErr('We lost a couple of answers. Start again from the top.');
      router.replace('/onboarding/name');
      return;
    }
    setBusy(true); setErr(null);
    try {
      patch({ availabilityMask: m });
      const p = await api.createProfile({
        displayName: draft.displayName, lastInitial: draft.lastInitial, dateOfBirth: draft.dateOfBirth,
        levelValue: draft.levelValue, levelSource: draft.levelSource, homeCourtId: draft.homeCourtId,
        availabilityMask: m, joinCode: draft.joinCode,
      });
      setProfile(p);
      // There is finally a row to attach it to, so hand over the fix taken at the court step.
      void flushLocation();
      if (draft.photoBase64) { try { setProfile(await api.setPhoto(draft.photoBase64)); } catch { /* photo is optional */ } }
      router.push(isMinor(draft.dateOfBirth) ? '/onboarding/guardian' : '/onboarding/ready');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const groups = [SLOTS.slice(0, 3), SLOTS.slice(3)];
  return (
    <Screen sky={150} bottom={
      <Centered>
        <Button title="Next" kind="ball" onPress={() => finish(mask)} loading={busy} disabled={mask === 0} />
        {/* Skipping is fine. Everything open beats a blank week. */}
        <Tap onPress={() => finish(ALL)} style={s.skip} tick accessibilityRole="button">
          <T v="smallM" tone="onCourt">Skip for now</T>
        </Tap>
      </Centered>
    }>
      <Centered>
        <View style={{ marginTop: space.lg, marginBottom: space.lg }}>
          <T v="display">When do you hit?</T>
          <T v="body" tone="ink2" style={{ marginTop: 4 }}>Rough is right. You pick exact times per hit.</T>
        </View>

        <Pop on={flexible}>
          <Tap onPress={() => setMask(flexible ? 0 : ALL)} tick style={[s.flex, flexible && s.flexOn]}
            accessibilityRole="checkbox" accessibilityState={{ checked: flexible }} aria-checked={flexible}>
            <View style={{ flex: 1 }}>
              <T v="h2" tone="ink">I'm flexible</T>
              <T v="small" tone={flexible ? 'ink' : 'ink2'} style={flexible ? { opacity: 0.75 } : undefined}>Anytime works. Just ask me.</T>
            </View>
          </Tap>
        </Pop>

        <T v="micro" tone="onCourt" style={{ marginTop: space.xl, marginBottom: space.sm }}>Or pick your usual</T>
        {groups.map((g, gi) => (
          <View key={gi} style={{ marginBottom: space.md }}>
            <T v="micro" tone="ink3" style={{ marginBottom: space.sm }}>{g[0].label}s</T>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {g.map(sl => {
                const on = !!(mask & sl.bit);
                return (
                  <Pop key={sl.bit} on={on} style={{ flex: 1 }}>
                    <Tap onPress={() => toggle(sl.bit)} tick style={[s.tile, on && s.on]}
                      accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on}
                      accessibilityLabel={`${sl.label} ${sl.part}`}>
                      <T v="bodyM" tone={on ? 'onBall' : 'ink'}>{sl.part}</T>
                    </Tap>
                  </Pop>
                );
              })}
            </View>
          </View>
        ))}
        {err && <Sheet style={{ marginTop: space.md }}><T v="small" tone="danger">{err}</T></Sheet>}
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  flex: { padding: space.lg, borderRadius: radius.lg, backgroundColor: color.paper, minHeight: 76, justifyContent: 'center' },
  flexOn: { backgroundColor: color.ball },
  tile: { flex: 1, minHeight: 64, borderRadius: radius.md, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: color.ball },
  skip: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
});
