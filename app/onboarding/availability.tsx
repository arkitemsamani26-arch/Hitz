import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pop } from '@/ui/Pop';
import { color, radius, space } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft, isMinor } from '@/store/onboarding';
import { useSession } from '@/store/session';
import { SLOTS } from '@/data/types';

export default function Availability() {
  const router = useRouter();
  const { draft, patch } = useDraft();
  const { setProfile } = useSession();
  const [mask, setMask] = useState(draft.availabilityMask);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (b: number) => setMask(m => m ^ b);
  const go = async () => {
    setBusy(true); setErr(null);
    try {
      patch({ availabilityMask: mask });
      const p = await api.createProfile({
        displayName: draft.displayName, lastInitial: draft.lastInitial, dateOfBirth: draft.dateOfBirth!,
        levelValue: draft.levelValue!, levelSource: draft.levelSource!, homeCourtId: draft.homeCourtId!, availabilityMask: mask, rosterCode: draft.rosterCode,
      });
      setProfile(p);
      if (draft.photoBase64) { try { setProfile(await api.setPhoto(draft.photoBase64)); } catch { /* photo is optional */ } }
      router.push(isMinor(draft.dateOfBirth) ? '/onboarding/guardian' : '/onboarding/ready');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const groups = [SLOTS.slice(0, 3), SLOTS.slice(3)];
  return (
    <Screen sky={230} bottom={<Centered><Button title="Next" kind="ball" onPress={go} loading={busy} disabled={mask === 0} /></Centered>}>
      <Centered>
        <T v="display" style={{ marginTop: space.xl }}>When can you{'\n'}usually hit?</T>
        <T v="body" tone="ink2" style={{ marginTop: space.lg, marginBottom: space.xl }}>Rough is right. You'll pick exact times per hit.</T>
        {groups.map((g, gi) => (
          <View key={gi} style={{ marginBottom: space.xl }}>
            <T v="micro" tone="onCourt" style={{ marginBottom: space.sm }}>{g[0].label}s</T>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {g.map(sl => {
                const on = !!(mask & sl.bit);
                return (
                  <Pop key={sl.bit} on={on} style={{ flex: 1 }}><Tap onPress={() => toggle(sl.bit)} tick style={[s.tile, on && s.on]} accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={`${sl.label} ${sl.part}`}>
                    <T v="bodyM" tone={on ? 'onBall' : 'ink'}>{sl.part}</T>
                  </Tap></Pop>
                );
              })}
            </View>
          </View>
        ))}
        {err && <T v="small" tone="onCourt">{err}</T>}
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  tile: { flex: 1, minHeight: 68, borderRadius: radius.md, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: color.ball },
});
