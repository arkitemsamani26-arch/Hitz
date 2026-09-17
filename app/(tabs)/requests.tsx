import React, { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Pill } from '@/ui/Pill';
import { Rally } from '@/ui/Rally';
import { Score } from '@/ui/Score';
import { Sheet } from '@/ui/Sheet';
import { CourtLines } from '@/ui/Court';
import { color, hit, space } from '@/theme/tokens';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { windowText, relTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { DECLINE_COPY, type DeclineReason, type HitRequest } from '@/data/types';

export default function Requests() {
  const router = useRouter();
  const { profile, tick } = useSession();
  const { data, loading, reload } = useAsync(() => api.requests(), [tick]);
  const [passing, setPassing] = useState<HitRequest | null>(null);
  const me = profile?.id;
  const all = data ?? [];
  const sections = [
    { title: 'Your move', data: all.filter(r => (r.state === 'pending' || r.state === 'countered') && r.awaitingId === me) },
    { title: 'Waiting on a parent', data: all.filter(r => r.state === 'accepted') },
    { title: 'On the calendar', data: all.filter(r => r.state === 'confirmed') },
    { title: 'Waiting on them', data: all.filter(r => (r.state === 'pending' || r.state === 'countered') && r.awaitingId !== me) },
    { title: 'Done', data: all.filter(r => ['declined', 'completed', 'cancelled', 'expired'].includes(r.state)) },
  ].filter(sec => sec.data.length > 0);

  const accept = async (r: HitRequest) => { await api.accept(r.id); haptic.accepted(); await reload(); };
  const decline = async (r: HitRequest, reason: DeclineReason) => { await api.decline(r.id, reason); await reload(); };

  return (
    <Screen scroll={false}>
      <Centered>
        <T v="display" style={{ letterSpacing: -1.5, marginBottom: space.lg }}>Requests</T>
        {loading && !data ? <Rally /> : sections.length === 0 ? (
          <View style={s.empty}>
            <CourtLines width={120} opacity={0.2} />
            <T v="h2" center>Nothing in play.</T>
            <T v="body" tone="ink2" center style={{ maxWidth: 280 }}>Send one from Hits. Most people reply the same day.</T>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={r => r.id}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => <T v="micro" tone="ink3" style={{ marginTop: space.xl, marginBottom: space.sm }}>{section.title}</T>}
            renderItem={({ item: r, section }) => (
              <Tap onPress={() => router.push(`/hit/${r.id}`)} style={s.row} scaleTo={0.985} accessibilityRole="button">
                <Score value={r.other.levelValue} size="h1" verified={r.other.levelVerified} />
                <View style={{ flex: 1, marginLeft: space.lg }}>
                  <T v="bodyM">{r.other.displayName} {r.other.lastInitial}. <T v="small" tone="ink3">· {relTime(r.createdAt)}</T></T>
                  <T v="small" tone="ink2" numberOfLines={1}>{windowText(new Date(r.windowStart), new Date(r.windowEnd))} · {r.courtName}</T>
                  {r.state === 'declined' && r.declineReason && <T v="small" tone="ink3">Passed · {r.declineReason}</T>}
                  {r.state === 'countered' && <T v="small" tone="cyan">Countered</T>}
                </View>
                {section.title === 'Your move' ? (
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Tap onPress={() => setPassing(r)} style={s.pass} accessibilityRole="button" accessibilityLabel="Pass" tick><T v="smallM">Pass</T></Tap>
                    <Tap onPress={() => accept(r)} style={s.yes} accessibilityRole="button" accessibilityLabel="Accept" tick><T v="smallM" tone="onBall">Yes</T></Tap>
                  </View>
                ) : r.state === 'confirmed' ? <Pill label="On" tone="ball" />
                  : r.state === 'accepted' ? <Pill label="Parent" tone="cyan" />
                  : r.state === 'completed' ? <Pill label="Played" tone="cyan" />
                  : null}
              </Tap>
            )}
            contentContainerStyle={{ paddingBottom: space.xxl }}
            showsVerticalScrollIndicator={false}
          />
        )}
        {/* Passing is fine. Say why in one tap; they get a real reply instead of silence. */}
        <Sheet open={!!passing} onClose={() => setPassing(null)} title={`Pass on ${passing?.other.displayName ?? ''} — they'll see why`}
          options={(Object.keys(DECLINE_COPY) as DeclineReason[]).map(k => ({ label: DECLINE_COPY[k], onPress: () => passing && decline(passing, k) }))} />
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: hit.row + 8, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.line },
  pass: { minHeight: 44, minWidth: 60, borderRadius: 999, borderWidth: 1.5, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  yes: { minHeight: 44, minWidth: 60, borderRadius: 999, backgroundColor: color.ball, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
});
