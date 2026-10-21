import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Loading } from '@/ui/Loading';
import { Field } from '@/ui/Field';
import { Pill } from '@/ui/Pill';
import { Icon } from '@/ui/Icon';
import { OptionSheet } from '@/ui/Sheet';
import { MemberCard, cardStats } from '@/ui/MemberCard';
import { name as nameOf } from '@/ui/Player';
import { useToast } from '@/ui/Toast';
import { hit, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useNextWindow } from '@/store/window';
import { useAsync } from '@/store/useAsync';
import { gapLine, overlapLine } from '@/lib/match';
import { dateLong } from '@/lib/format';
import { statusOf } from '@/lib/status';
import { slotsOf, slotsSummary } from '@/data/types';
import { isPlusError, plusLine } from '@/lib/plus';

const REASONS = [
  { k: 'fake_profile', l: 'Fake profile' }, { k: 'inappropriate_messages', l: 'Inappropriate messages' },
  { k: 'age_misrepresentation', l: 'Not the age they say' }, { k: 'no_show', l: "Didn't show up" },
  { k: 'safety_concern', l: 'I felt unsafe' }, { k: 'other', l: 'Something else' },
];

export default function PlayerScreen() {
  const { id, report } = useLocalSearchParams<{ id: string; report?: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const { profile, tick } = useSession();
  const win = useNextWindow(profile?.availabilityMask ?? 0);
  const { data: p, loading } = useAsync(() => api.player(id), [id]);
  const reqs = useAsync(() => api.requests(), [tick]);
  const market = useAsync(() => api.marketStatus(), []);
  const [more, setMore] = useState(false);
  const [reporting, setReporting] = useState(!!report);
  const [reason, setReason] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const canRequest = !!profile && (profile.band === 'adult' || profile.guardianVerified);
  // Plus: a private note on this player. Only you ever see it.
  const plus = !!profile?.plus;
  const note = useAsync(() => (plus ? api.partnerNote(id) : Promise.resolve(null)), [id, plus]);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const saveNote = async () => {
    if (noteDraft == null) return;
    setSavingNote(true);
    try { await api.setPartnerNote(id, noteDraft.trim() || null); await note.reload(); setNoteDraft(null); toast(noteDraft.trim() ? 'Saved. Only you see it.' : 'Note removed.'); }
    catch (e: any) { if (isPlusError(e)) router.push('/plus?why=notes'); else toast(e?.message ?? "Couldn't save that."); }
    finally { setSavingNote(false); }
  };
  if (loading && !p) return <Screen><Centered><Header backLabel="Back to players" /><Loading /></Centered></Screen>;
  if (!p) return <Screen><Centered><Header backLabel="Back to players" /><Card><T v="body" tone="muted">Can't find them.</T></Card></Centered></Screen>;

  const submitReport = async () => {
    if (!reason || sending) return;
    setSending(true);
    try { await api.report(p.id, reason, body); setReporting(false); toast('Got it. A person reads every one of these, same day.'); }
    catch (e: any) { toast(e?.message ?? "Couldn't send that report."); }
    finally { setSending(false); }
  };
  const when = profile ? overlapLine(profile, p, win) : null;
  const free = slotsOf(p.availabilityMask);
  // Everything the two of you have had going, newest first. A live one opens the thread.
  const together = (reqs.data ?? []).filter(r => r.other.id === p.id).sort((a, b) => b.windowStart.localeCompare(a.windowStart));
  const live = together.find(r => ['pending', 'countered', 'accepted', 'confirmed'].includes(r.state) && new Date(r.windowEnd) > new Date());
  const played = together.filter(r => r.state === 'completed').length;

  return (
    <Screen bottom={!reporting ? <Centered><Button arrow title={canRequest ? 'Invite to hit' : 'Unlocks when your parent says yes'} disabled={!canRequest} onPress={() => router.push(`/request/${p.id}`)} /></Centered> : undefined}>
      <Centered>
        <Header backLabel="Back to players" right={<Tap onPress={() => setMore(true)} style={{ minWidth: hit.min, minHeight: hit.min, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="More options for this player"><Icon name="ellipsis" size={18} color={t.ink} /></Tap>} />
        <MemberCard name={nameOf(p)} lastInitial={p.lastInitial} photo={p.photoUrl} level={p.levelValue} source={p.levelSource} verified={p.levelVerified}
          area={p.distanceBucket ? `${p.distanceBucket} away` : market.data?.marketName ?? 'Palo Alto'} court={p.homeCourtName} age={p.age} looking={p.lookingToHit}
          stats={cardStats(p)} line={[p.prefers ? `Here for ${p.prefers.toLowerCase()}` : null, p.availabilityMask ? `plays ${slotsSummary(p.availabilityMask).toLowerCase()}` : null].filter(Boolean).join(', ') + (p.prefers || p.availabilityMask ? '.' : '')}
          plus={p.plus} bio={p.bio} styleLine={plusLine(p)} actionPhoto={p.actionPhotoUrl} />

        {/* Your note on them. Plus; on the free plan the row is the way to the paywall. */}
        {plus ? (
          <Card style={{ marginTop: space.md, gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="pencil" size={15} color={t.ink} />
              <T v="micro" tone="muted" style={{ flex: 1 }}>Your note · only you see it</T>
            </View>
            {noteDraft == null ? (
              <Tap onPress={() => setNoteDraft(note.data ?? '')} style={{ minHeight: hit.min, justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={note.data ? `Your note: ${note.data}. Edit.` : `Add a note about ${p.displayName}`}>
                <T v="small" tone={note.data ? 'ink' : 'muted'}>{note.data ?? `"Big forehand, likes two-hour sets." A line to remember ${p.displayName} by.`}</T>
              </Tap>
            ) : (
              <>
                <Field value={noteDraft} onChangeText={setNoteDraft} placeholder={`About ${p.displayName}`} maxLength={280} multiline accessibilityLabel={`Your note about ${p.displayName}`} />
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button title="Cancel" kind="ghost" small onPress={() => setNoteDraft(null)} />
                  <Button title="Save" small onPress={saveNote} loading={savingNote} style={{ flex: 1 }} />
                </View>
              </>
            )}
          </Card>
        ) : (
          <Tap onPress={() => router.push('/plus?why=notes')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: hit.min, marginTop: space.sm }} accessibilityRole="button" accessibilityLabel={`A private note about ${p.displayName}, part of Plus. See Plus.`}>
            <Icon name="pencil" size={14} color={t.muted} />
            <T v="meta" tone="muted" style={{ flex: 1 }}>Keep a private note on {p.displayName} with Plus.</T>
            <Icon name="lock" size={13} color={t.muted} />
          </Tap>
        )}

        {live && (
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }}>
            <Button title={`Message ${p.displayName}`} kind="line" small icon="message-circle" onPress={() => router.push(`/chat/${live.id}`)} style={{ flexGrow: 1 }} />
            <Button title="Open the hit" kind="line" small icon="calendar-days" onPress={() => router.push(`/hit/${live.id}`)} style={{ flexGrow: 1 }} />
          </View>
        )}

        {profile && (
          <>
            <T v="micro" tone="muted" style={{ marginTop: 24, marginBottom: 10 }}>You two</T>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}>
                <Icon name="trophy" size={16} color={t.ink} style={{ marginTop: 2 }} />
                <T v="small" style={{ flex: 1 }}>{gapLine(profile, p)}</T>
              </View>
              {p.age != null && profile.age != null && (
                <View style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}>
                  <Icon name="users" size={16} color={t.ink} style={{ marginTop: 2 }} />
                  <T v="small" style={{ flex: 1 }}>{p.age === profile.age ? `You're both ${p.age}.` : `${p.displayName} is ${p.age}; you're ${profile.age}.`}</T>
                </View>
              )}
              {played > 0 && (
                <View style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}>
                  <Icon name="check" size={16} color={t.ink} style={{ marginTop: 2 }} />
                  <T v="small" style={{ flex: 1 }}>You've hit together {played === 1 ? 'once' : `${played} times`}.</T>
                </View>
              )}
            </Card>
          </>
        )}
        <T v="micro" tone="muted" style={{ marginTop: 24, marginBottom: 10 }}>When</T>
        <Card style={{ gap: space.sm }}>
          {when && (
            <View style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}>
              <Icon name={when.known ? 'calendar-check-2' : 'calendar'} size={16} color={t.ink} style={{ marginTop: 2 }} />
              <T v="smallM" style={{ flex: 1 }}>{when.text}</T>
            </View>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
            {free.length ? free.map(f => <Pill key={f} label={f} />) : <T v="meta" tone="muted">They haven't said when they usually play.</T>}
          </View>
        </Card>
        <T v="meta" tone="muted" style={{ marginTop: space.md, lineHeight: 18 }}>
          {p.levelVerified ? 'Rating verified through UTR.' : 'Rating is self-reported. Close enough is normal; way off is worth a report.'}
        </T>

        {together.length > 0 && (
          <>
            <T v="micro" tone="muted" style={{ marginTop: 24, marginBottom: 10 }}>Your hits together</T>
            <Card style={{ paddingVertical: 2 }}>
              {together.slice(0, 4).map((r, i) => {
                const st = statusOf(r, profile?.id);
                return (
                  <Tap key={r.id} onPress={() => router.push(`/hit/${r.id}`)} style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: 10 }, i > 0 && { borderTopWidth: 1, borderTopColor: t.line }]}
                    accessibilityRole="button" accessibilityLabel={`${st.label}. ${dateLong(new Date(r.windowStart))}, ${r.courtName}. Open.`}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="smallM" numberOfLines={1}>{dateLong(new Date(r.windowStart))}</T>
                      <T v="meta" tone="muted" numberOfLines={1}>{r.courtName}</T>
                    </View>
                    <Pill label={st.label} icon={st.icon} />
                  </Tap>
                );
              })}
            </Card>
          </>
        )}

        {reporting && (
          <Card style={{ marginTop: space.lg, gap: space.md }}>
            <T v="h2">Report {p.displayName}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {REASONS.map(r => <Pill key={r.k} label={r.l} on={reason === r.k} onPress={() => setReason(r.k)} />)}
            </View>
            <Field value={body} onChangeText={setBody} placeholder="What happened? (optional)" multiline accessibilityLabel="What happened" />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title="Never mind" kind="ghost" small onPress={() => setReporting(false)} />
              <Button title="Send report" small onPress={submitReport} disabled={!reason} loading={sending} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        <OptionSheet open={more} onClose={() => setMore(false)} options={[
          { label: 'Report', sub: 'Goes to a person, same day', onPress: () => setReporting(true), danger: true },
          { label: `Block ${p.displayName}`, sub: 'You disappear from each other. No notification.', onPress: async () => { try { await api.block(p.id); router.replace('/(tabs)'); } catch (e: any) { toast(e?.message ?? "Couldn't block."); } }, danger: true },
        ]} />
      </Centered>
    </Screen>
  );
}
