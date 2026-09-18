import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Rally } from '@/ui/Rally';
import { color, hit, space } from '@/theme/tokens';
import { api, demo } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { windowText, levelBig } from '@/lib/format';

export default function GuardianHome() {
  const router = useRouter();
  const { tick, refresh } = useSession();
  const { data: kids, loading } = useAsync(() => api.guardianChildren(), [tick]);
  return (
    <Screen sky={200}>
      <Centered>
        <View style={{ marginTop: space.lg, marginBottom: space.xl }}>
          <T v="micro" tone="ink2">Hits · Parent</T>
          <T v="display" style={{ fontSize: 34, lineHeight: 36 }}>Your kid finds the hit.{'\n'}You approve the meeting.</T>
        </View>
        {loading && !kids ? <Rally /> : (kids ?? []).map(k => (
          <View key={k.profile.id} style={{ marginBottom: space.xl }}>
            <Sheet style={{ marginBottom: space.md }}>
              <View style={s.kid}><T v="h2">{k.profile.displayName}</T><Pill label={`Level ${levelBig(k.profile.levelValue)}`} tone="faint" /><Pill label={`${k.profile.hitsConfirmed} hits`} tone="faint" /></View>
            </Sheet>
            <T v="micro" tone="onCourt" style={{ marginBottom: space.sm }}>Needs your OK</T>
            {k.pendingApprovals.length === 0
              ? <Sheet style={{ marginBottom: space.md }}><T v="body" tone="ink2">Nothing waiting. You'll get a text when something is.</T></Sheet>
              : k.pendingApprovals.map(a => (
                <Tap key={a.hitId} onPress={() => router.push(`/guardian/approve/${a.hitId}`)} scaleTo={0.985} accessibilityRole="button">
                  <Sheet accent style={s.card}>
                    <View style={{ flex: 1 }}>
                      <T v="bodyM">{k.profile.displayName} + {a.request.other.displayName} {a.request.other.lastInitial}.</T>
                      <T v="small" tone="ink2">{windowText(new Date(a.request.windowStart), new Date(a.request.windowEnd))}</T>
                      <T v="small" tone="ink2">{a.request.courtName}</T>
                    </View>
                    <T v="h2" tone="court">Review →</T>
                  </Sheet>
                </Tap>
              ))}
            <T v="micro" tone="onCourt" style={{ marginTop: space.md, marginBottom: space.sm }}>On the calendar</T>
            <Sheet style={{ paddingVertical: 4 }}>
              {k.upcoming.length === 0 ? <T v="body" tone="ink2" style={{ paddingVertical: space.md }}>No confirmed hits yet.</T> : k.upcoming.map(r => (
                <Tap key={r.id} onPress={() => router.push(`/guardian/approve/${r.id}`)} style={s.row} accessibilityRole="button">
                  <View style={{ flex: 1 }}><T v="bodyM">with {r.other.displayName} {r.other.lastInitial}.</T><T v="small" tone="ink2">{windowText(new Date(r.windowStart), new Date(r.windowEnd))} · {r.courtName}</T></View>
                  <Pill label="Approved" tone="court" />
                </Tap>
              ))}
            </Sheet>
          </View>
        ))}
        <T v="small" tone="onCourt" style={{ opacity: 0.9 }}>You see every request and every message on {kids?.[0]?.profile.displayName ?? 'your kid'}'s account, in full. Adults can't find or contact under-18s on Hits — that's enforced in the database, not a setting.</T>
        {demo && (() => { const d = demo; return (
          <View style={{ marginTop: space.xl }}>
            <Button title="Back to the player view (demo)" kind="white" onPress={async () => { d.switchToPlayer(); await refresh(); router.replace('/(tabs)'); }} />
          </View>
        ); })()}
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  kid: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: hit.row, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.hair, gap: space.md },
});
