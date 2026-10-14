// Messages. Every conversation in one list, newest first, with what you have not read
// marked. Each thread belongs to a hit, so the plan is never more than one tap away.
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Avatar } from '@/ui/Avatar';
import { Loading } from '@/ui/Loading';
import { Icon } from '@/ui/Icon';
import { font, hit, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { useBus } from '@/store/bus';
import { chatTime, hitShort } from '@/lib/format';
import type { HitRequest, InboxEntry } from '@/data/types';

// What a thread says before anyone has typed in it. The line under it carries the when
// and where, so this is just where things stand.
function quiet(r: HitRequest, me: string | undefined): string {
  switch (r.state) {
    case 'pending': return r.awaitingId === me ? 'Invited you to hit. Say hi.' : 'You sent an invitation. Say hi.';
    case 'countered': return r.awaitingId === me ? 'Suggested another time' : 'You suggested another time';
    case 'accepted': return 'Waiting on a parent to approve';
    case 'confirmed': return new Date(r.windowEnd) < new Date() ? 'You hit together' : "It's on. Sort out the details.";
    case 'completed': return 'You hit together';
    case 'declined': return 'Passed on this one';
    case 'cancelled': return 'Cancelled';
    case 'expired': return 'Expired';
  }
}

export default function Messages() {
  const router = useRouter();
  const t = useTheme();
  const s = useS();
  const { profile, tick } = useSession();
  const read = useBus('inbox');
  const reqs = useAsync(() => api.requests(), [tick]);
  const inbox = useAsync(() => api.inbox(), [tick, read]);
  const me = profile?.id;

  const threads = useMemo(() => {
    const by = new Map<string, InboxEntry>((inbox.data ?? []).map(x => [x.hitId, x]));
    return (reqs.data ?? [])
      // A thread worth listing: the hit is still live, or someone said something in it.
      .filter(r => ['pending', 'countered', 'accepted', 'confirmed', 'completed'].includes(r.state) || by.get(r.id)?.lastBody)
      .map(r => ({ r, x: by.get(r.id) }))
      .sort((a, b) => (b.x?.lastAt ?? b.r.createdAt).localeCompare(a.x?.lastAt ?? a.r.createdAt));
  }, [reqs.data, inbox.data]);
  const unread = threads.reduce((n, th) => n + (th.x?.unread ?? 0), 0);

  return (
    <Screen onRefresh={async () => { await Promise.all([reqs.reload(), inbox.reload()]); }}>
      <Centered>
        <T v="eyebrow" tone="muted" style={{ marginTop: 10 }}>Messages</T>
        <T v="display" style={st.h} accessibilityRole="header">Talk it{'\n'}<T v="display" italic>through.</T></T>
        <T v="small" tone="muted" style={st.sub}>
          {unread > 0 ? `${unread} new ${unread === 1 ? 'message' : 'messages'}. ` : ''}One thread for each hit: the time, the court, who brings balls.
          {profile?.band === 'minor' ? ' Your parent can read these.' : ''}
        </T>

        {(reqs.loading && !reqs.data) ? <Loading label="Loading your messages" /> : threads.length === 0 ? (
          <Card style={{ gap: space.sm }}>
            <View style={s.emptyIcon}><Icon name="message-circle" size={22} color={t.ink} /></View>
            <T v="h2">No conversations yet.</T>
            <T v="small" tone="muted">Send someone an invitation and a thread opens with it. You can talk before they say yes.</T>
            <Button title="Find someone to hit with" arrow onPress={() => router.push('/(tabs)')} style={{ marginTop: space.sm }} />
          </Card>
        ) : (
          <Card style={{ paddingVertical: 2, paddingHorizontal: 0 }}>
            {threads.map(({ r, x }, i) => {
              const n = x?.unread ?? 0;
              const mine = x?.lastSenderId === me;
              const preview = x?.lastBody ? `${mine ? 'You: ' : ''}${x.lastBody}` : quiet(r, me);
              const when = x?.lastAt ?? r.createdAt;
              return (
                <Tap key={r.id} onPress={() => router.push(`/chat/${r.id}`)} style={[s.row, i > 0 && s.rule]} scaleTo={0.99}
                  accessibilityRole="button" accessibilityLabel={`${r.other.displayName}${n ? `, ${n} unread` : ''}. ${preview}. ${chatTime(when)}. Open the conversation.`}>
                  <Avatar name={r.other.displayName} lastInitial={r.other.lastInitial} photo={r.other.photoUrl} size={48} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={st.line}>
                      <T v="smallM" numberOfLines={1} style={[{ flex: 1, fontSize: 15, lineHeight: 20 }, n > 0 && { fontFamily: font.bold }]}>
                        {r.other.displayName}{r.other.lastInitial ? ` ${r.other.lastInitial}.` : ''}
                      </T>
                      <T v="meta" tone={n ? 'green' : 'muted'} style={n ? { fontFamily: font.medium } : undefined}>{chatTime(when)}</T>
                    </View>
                    <View style={st.line}>
                      <T v="small" tone={n ? 'ink' : 'muted'} numberOfLines={1} style={[{ flex: 1 }, n > 0 && { fontFamily: font.medium }]}>{preview}</T>
                      {n > 0 && <View style={s.count}><T v="meta" tone="greenText" style={{ fontFamily: font.bold, fontSize: 11, lineHeight: 14 }}>{n}</T></View>}
                    </View>
                    <T v="meta" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>{hitShort(r.windowStart)} · {r.courtName}</T>
                  </View>
                </Tap>
              );
            })}
          </Card>
        )}
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 12 },
  sub: { marginBottom: 20, lineHeight: 21 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
const useS = makeStyles(c => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 15, minHeight: hit.row + 18 },
  rule: { borderTopWidth: 1, borderTopColor: c.line },
  count: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
}));
