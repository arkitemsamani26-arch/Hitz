// The family view. A parent's home: each child they are linked to, what needs their OK,
// what is on the calendar, and who each child is allowed to hit with. A parent with two
// kids sees both here, side by side, under one sign-in.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Icon } from '@/ui/Icon';
import { Loading } from '@/ui/Loading';
import { Avatar } from '@/ui/Avatar';
import { Wordmark } from '@/ui/Wordmark';
import { MemberCard } from '@/ui/MemberCard';
import { OptionSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { font, hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api, demo } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { dateLong, rangeText } from '@/lib/format';
import { display as phoneDisplay } from '@/lib/phone';
import { shareText } from '@/lib/share';
import { legal } from '@/lib/links';
import { slotsSummary, type GuardianChild } from '@/data/types';
import { entryText, tournamentDates } from '@/lib/tournaments';

// The choices a parent has for who their child can be matched with.
const GAPS: { gap: number | null; label: string }[] = [
  { gap: 1, label: 'Within 1 year' }, { gap: 2, label: 'Within 2 years' }, { gap: 3, label: 'Within 3 years' }, { gap: null, label: 'Any age under 18' },
];

export default function Family() {
  const router = useRouter();
  const t = useTheme();
  const s = useS();
  const { tick, refresh, session, setSession, setProfile } = useSession();
  const toast = useToast();
  const kids = useAsync(() => api.guardianChildren(), [tick]);
  const links = useAsync(() => api.guardianLinks(), [tick]);
  const courts = useAsync(() => api.courts(), []);
  const coachLinks = useAsync(() => api.guardianCoachLinks(), [tick]);
  // Plus: the parent's one plan covers every child; a child who asked for it shows here.
  const plus = useAsync(() => api.myPlus(), [tick]);
  const plusAsks = useAsync(() => api.guardianPlusRequests(), [tick]);
  const [sel, setSel] = useState<string | null>(null);
  const tourneys = useAsync(() => (sel ? api.tournaments(sel) : Promise.resolve([])), [sel, tick]);
  const childEntries = (tourneys.data ?? []).filter(x => x.entered);
  const [revoking, setRevoking] = useState<{ id: string; childName: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const all = kids.data ?? [];
  useEffect(() => { if (all.length && !all.some(k => k.profile.id === sel)) setSel(all[0].profile.id); }, [all, sel]);
  const k: GuardianChild | undefined = all.find(x => x.profile.id === sel);
  const pendingCoach = (coachLinks.data ?? []).filter(c => !c.approved);
  const waiting = all.reduce((n, x) => n + x.pendingApprovals.length, 0) + pendingCoach.length;
  const decideCoach = async (childId: string, coachId: string, ok: boolean, coachName: string) => {
    try { await api.guardianDecideCoach(childId, coachId, ok); await coachLinks.reload(); toast(ok ? `Approved Coach ${coachName}.` : `Coach ${coachName} removed.`); }
    catch (e: any) { toast(e?.message ?? "That didn't go through."); }
  };
  const link = useMemo(() => (links.data ?? []).find(l => l.childId === k?.profile.id) ?? null, [links.data, k]);

  const setGap = async (gap: number | null) => {
    if (!k || saving) return;
    setSaving(true);
    try {
      await api.setChildAgeGap(k.profile.id, gap); await kids.reload();
      toast(gap ? `${k.profile.displayName} now sees players within ${gap} ${gap === 1 ? 'year' : 'years'} of their age.` : `${k.profile.displayName} can see any player under 18.`);
    } catch (e: any) { toast(e?.message ?? "That didn't save."); }
    finally { setSaving(false); }
  };
  const decidePhoto = async (approve: boolean) => {
    if (!k) return;
    try { await api.guardianApprovePhoto(k.profile.id, approve); toast(approve ? 'Photo approved.' : 'Photo removed.'); await refresh(); await kids.reload(); }
    catch (e: any) { toast(e?.message ?? "That didn't go through. Try again."); }
  };
  const decideActionPhoto = async (approve: boolean) => {
    if (!k) return;
    try { await api.guardianApproveActionPhoto(k.profile.id, approve); toast(approve ? 'Action photo approved.' : 'Action photo removed.'); await refresh(); await kids.reload(); }
    catch (e: any) { toast(e?.message ?? "That didn't go through. Try again."); }
  };
  const shareSteps = async () => {
    const mine = session?.phone ? phoneDisplay(session.phone) : 'my number';
    const how = await shareText(`Get Hits for tennis partners your age. When it asks for a parent, enter ${mine}. I'll get a text and can approve it.`);
    if (how === 'copied') toast('Copied. Send it to your child.');
    else if (how === 'failed') toast("Couldn't share from here.");
  };

  return (
    <Screen onRefresh={refresh}>
      <Centered>
        <View style={{ marginTop: space.md }}>
          <Wordmark />
          <T v="eyebrow" tone="muted" style={{ marginTop: space.lg }}>Your family</T>
          <T v="display" style={{ marginTop: 12, marginBottom: 10 }} accessibilityRole="header">They find the hit.{'\n'}<T v="display" italic>You approve the meeting.</T></T>
        </View>

        {kids.loading && !kids.data ? <Loading /> : (
          <>
            {/* Everyone in the family, and a way to add the next one. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.strip}>
              {all.map(x => {
                const on = x.profile.id === sel;
                const n = x.pendingApprovals.length + pendingCoach.filter(c => c.childId === x.profile.id).length;
                return (
                  <Tap key={x.profile.id} onPress={() => setSel(x.profile.id)} style={[s.kid, on && s.kidOn]} scaleTo={0.97}
                    accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${x.profile.displayName}${x.profile.age != null ? `, ${x.profile.age}` : ''}${n ? `, ${n} waiting for your OK` : ''}`}>
                    <View>
                      <Avatar name={x.profile.displayName} lastInitial={x.profile.lastInitial} photo={x.profile.photoUrl} size={52} />
                      {n > 0 && <View style={s.badge}><T v="meta" style={st.badgeText}>{n}</T></View>}
                    </View>
                    <T v="smallM" numberOfLines={1} style={{ marginTop: 8 }}>{x.profile.displayName}</T>
                    <T v="meta" tone="muted">{x.profile.age != null ? `Age ${x.profile.age}` : 'Under 18'}</T>
                  </Tap>
                );
              })}
              <Tap onPress={shareSteps} style={[s.kid, s.add]} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Add another child">
                <View style={s.addIcon}><Icon name="plus" size={22} color={t.ink} /></View>
                <T v="smallM" style={{ marginTop: 8 }}>Add a child</T>
                <T v="meta" tone="muted">Send the steps</T>
              </Tap>
            </ScrollView>

            {/* Hits Plus for the family: one plan on this sign-in covers every child here. */}
            {plus.data?.plus ? (
              <Tap onPress={() => router.push('/plus')} style={[s.plusRow, s.plusRowOn]} accessibilityRole="button" accessibilityLabel="Hits Plus is on and covers your children. Open.">
                <View style={s.plusBadge}><T v="micro" style={st.plusText}>Plus</T></View>
                <View style={{ flex: 1 }}><T v="smallM">Plus covers your children</T><T v="meta" tone="muted">Auto-match, every filter and their stats, on every account you manage.</T></View>
                <Icon name="chevron-right" size={15} color={t.muted} />
              </Tap>
            ) : (plusAsks.data ?? []).length > 0 ? (
              <Card stripe style={{ gap: space.sm, marginTop: 4 }}>
                <T v="smallM">{(plusAsks.data ?? []).map(x => x.childName).join(' and ')} asked for Hits Plus</T>
                <T v="meta" tone="muted">$4.99 a month on your account covers every child you manage: auto-match, every filter, unlimited invitations, their stats. Nothing about safety or who they can reach changes.</T>
                <Button title="See Plus" arrow onPress={() => router.push('/plus')} />
              </Card>
            ) : null}

            {waiting > 0 && (
              <View style={s.alert}>
                <Icon name="clock-3" size={15} color={t.ink} />
                <T v="small" style={{ flex: 1 }}>{waiting === 1 ? 'One thing needs your OK.' : `${waiting} things need your OK.`}</T>
              </View>
            )}

            {k && (
              <>
                <MemberCard eyebrow="Your child" name={`${k.profile.displayName}${k.profile.lastInitial ? ` ${k.profile.lastInitial}.` : ''}`} lastInitial={k.profile.lastInitial}
                  photo={k.profile.photoUrl} level={k.profile.levelValue} source={k.profile.levelSource} verified={k.profile.levelSource === 'utr_verified'}
                  court={courts.data?.find(c => c.id === k.profile.homeCourtId)?.name ?? null} age={k.profile.age}
                  stats={[{ value: String(k.profile.hitsConfirmed), label: k.profile.hitsConfirmed === 1 ? 'Hit played' : 'Hits played' }, { value: String(k.upcoming.length), label: 'Coming up' }]}
                  line={k.profile.availabilityMask ? `Usually free ${slotsSummary(k.profile.availabilityMask).toLowerCase()}.` : null} style={{ marginTop: space.md }} />

                {k.profile.photoPendingUrl && (
                  <Card stripe style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <Avatar name={k.profile.displayName} photo={k.profile.photoPendingUrl} size={52} />
                    <View style={{ flex: 1 }}><T v="smallM">{k.profile.displayName} added a photo</T><T v="meta" tone="muted">Nobody sees it until you say so.</T></View>
                    <View style={{ gap: space.xs }}>
                      <Button title="Approve" small onPress={() => void decidePhoto(true)} />
                      <Button title="Remove" kind="line" small onPress={() => void decidePhoto(false)} />
                    </View>
                  </Card>
                )}

                {k.profile.actionPhotoPendingUrl && (
                  <Card stripe style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <Avatar name={k.profile.displayName} photo={k.profile.actionPhotoPendingUrl} size={52} />
                    <View style={{ flex: 1 }}><T v="smallM">{k.profile.displayName} added an action photo</T><T v="meta" tone="muted">For their card. Nobody sees it until you say so.</T></View>
                    <View style={{ gap: space.xs }}>
                      <Button title="Approve" small onPress={() => void decideActionPhoto(true)} />
                      <Button title="Remove" kind="line" small onPress={() => void decideActionPhoto(false)} />
                    </View>
                  </Card>
                )}

                {/* Coaches this child joined. One approval, by name, before the coach sees them. */}
                {(coachLinks.data ?? []).filter(c => c.childId === k.profile.id && !c.approved).map(c => (
                  <Card key={c.coachId} stripe style={{ marginTop: space.md, gap: space.sm }}>
                    <T v="smallM">{k.profile.displayName} wants to join Coach {c.coachName}'s roster</T>
                    <T v="meta" tone="muted">{c.academy}. A coach can suggest juniors for {k.profile.displayName} to hit with. They can't message {k.profile.displayName}, and you still approve every hit.</T>
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <Button title="Approve" small onPress={() => void decideCoach(c.childId, c.coachId, true, c.coachName)} style={{ flex: 1 }} />
                      <Button title="Decline" kind="line" small onPress={() => void decideCoach(c.childId, c.coachId, false, c.coachName)} />
                    </View>
                  </Card>
                ))}

                <T v="micro" tone="muted" style={st.k}>Needs your OK</T>
                {k.pendingApprovals.length === 0
                  ? <Card><T v="small" tone="muted">Nothing waiting. You'll get a text when something is.</T></Card>
                  : k.pendingApprovals.map(a => (
                    <Tap key={a.hitId} onPress={() => router.push(`/guardian/approve/${a.hitId}`)} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={`Review the hit with ${a.request.other.displayName}`}>
                      <Card stripe style={st.card}>
                        <Avatar name={a.request.other.displayName} lastInitial={a.request.other.lastInitial} photo={a.request.other.photoUrl} size={42} />
                        <View style={{ flex: 1 }}>
                          <T v="smallM">With {a.request.other.displayName} {a.request.other.lastInitial}.{a.request.other.age != null ? `, ${a.request.other.age}` : ''}</T>
                          <T v="meta" tone="muted">{dateLong(new Date(a.request.windowStart))}, {rangeText(new Date(a.request.windowStart), new Date(a.request.windowEnd))}</T>
                          <T v="meta" tone="muted">{a.request.courtName}</T>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><T v="smallM" tone="green">Review</T><Icon name="chevron-right" size={15} color={t.green} /></View>
                      </Card>
                    </Tap>
                  ))}

                <T v="micro" tone="muted" style={st.k}>On the calendar</T>
                <Card style={{ paddingVertical: 4 }}>
                  {k.upcoming.length === 0 ? <T v="small" tone="muted" style={{ paddingVertical: space.md }}>No confirmed hits coming up.</T> : k.upcoming.map((r, i) => (
                    <Tap key={r.id} onPress={() => router.push(`/guardian/approve/${r.id}`)} style={[st.row, i > 0 && s.rule]} accessibilityRole="button"
                      accessibilityLabel={`With ${r.other.displayName}, ${dateLong(new Date(r.windowStart))}, ${r.courtName}. Open.`}>
                      <Avatar name={r.other.displayName} lastInitial={r.other.lastInitial} photo={r.other.photoUrl} size={38} />
                      <View style={{ flex: 1 }}>
                        <T v="smallM">With {r.other.displayName} {r.other.lastInitial}.{r.other.age != null ? `, ${r.other.age}` : ''}</T>
                        <T v="meta" tone="muted">{dateLong(new Date(r.windowStart))}, {rangeText(new Date(r.windowStart), new Date(r.windowEnd))} · {r.courtName}</T>
                      </View>
                      <Pill label="Approved" icon="check" />
                    </Tap>
                  ))}
                </Card>

                {childEntries.length > 0 && (
                  <>
                    <T v="micro" tone="muted" style={st.k}>Tournaments</T>
                    <Card style={{ paddingVertical: 4 }}>
                      {childEntries.map((x, i) => (
                        <View key={x.id} style={[st.row, i > 0 && s.rule]}>
                          <Icon name="trophy" size={17} color={t.ink} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <T v="smallM" numberOfLines={1}>{x.name}</T>
                            <T v="meta" tone="muted" numberOfLines={2}>{tournamentDates(x)} · {entryText(x)}{x.wantsPartner ? ' · looking for a partner' : ''}</T>
                          </View>
                          <Button title="Take off" small kind="ghost" onPress={async () => {
                            try { await api.leaveTournament(x.id, k.profile.id); await tourneys.reload(); toast(`${k.profile.displayName} is off the list for ${x.name}.`); }
                            catch (e: any) { toast(e?.message ?? "That didn't go through."); }
                          }} />
                        </View>
                      ))}
                    </Card>
                    <T v="meta" tone="muted" style={{ marginTop: 8, lineHeight: 18 }}>Only other players under 18 your age rule allows can see {k.profile.displayName} is playing.</T>
                  </>
                )}

                {/* The parent's one setting: how close in age their child's partners are. */}
                <T v="micro" tone="muted" style={st.k}>Who {k.profile.displayName} can hit with</T>
                <Card style={{ gap: space.sm }}>
                  <View style={st.chips}>
                    {GAPS.map(g => <Pill key={g.label} label={g.label} on={(k.profile.maxPartnerAgeGap ?? null) === g.gap} onPress={() => void setGap(g.gap)} />)}
                  </View>
                  <T v="meta" tone="muted" style={{ lineHeight: 18 }}>
                    {k.profile.maxPartnerAgeGap && k.profile.age != null
                      ? `${k.profile.displayName} is ${k.profile.age}, so they only see and invite players aged ${Math.max(10, k.profile.age - k.profile.maxPartnerAgeGap)} to ${Math.min(17, k.profile.age + k.profile.maxPartnerAgeGap)}.`
                      : `${k.profile.displayName} can see any player under 18. Adults never appear, whatever you choose.`} You still approve every meetup.
                  </T>
                </Card>

                {(coachLinks.data ?? []).some(c => c.childId === k.profile.id && c.approved) && (
                  <>
                    <T v="micro" tone="muted" style={st.k}>{k.profile.displayName}'s coaches</T>
                    <Card style={{ paddingVertical: 4 }}>
                      {(coachLinks.data ?? []).filter(c => c.childId === k.profile.id && c.approved).map((c, i) => (
                        <View key={c.coachId} style={[st.row, i > 0 && s.rule]}>
                          <Icon name="handshake" size={17} color={t.ink} />
                          <View style={{ flex: 1 }}><T v="smallM">Coach {c.coachName}</T><T v="meta" tone="muted">{c.academy}{c.coachVerified ? '' : ' · Hits is checking this coach'}</T></View>
                          <Button title="Remove" kind="ghost" small onPress={() => void decideCoach(c.childId, c.coachId, false, c.coachName)} />
                        </View>
                      ))}
                    </Card>
                  </>
                )}

                {link && (
                  <Tap onPress={() => setRevoking({ id: link.id, childName: link.childName })} style={st.remove} accessibilityRole="button" accessibilityLabel={`Remove your link to ${link.childName}`}>
                    <T v="small" tone="danger">Remove your link to {link.childName}</T>
                  </Tap>
                )}
              </>
            )}

            {all.length === 0 && (
              <Card style={{ gap: space.sm, marginTop: space.md }}>
                <T v="h2">No children linked yet.</T>
                <T v="small" tone="muted">Your child signs up on their own phone and enters your number when it asks for a parent. You get a text; tap it to link.</T>
                <Button title="Send them the steps" kind="line" small onPress={shareSteps} style={{ alignSelf: 'flex-start' }} />
              </Card>
            )}
          </>
        )}

        <T v="meta" tone="muted" style={{ lineHeight: 18, marginTop: space.lg }}>You see every invitation and every message on your children's accounts, in full. No adult can find or contact an under-18 on Hits. The database enforces it.</T>

        <OptionSheet open={!!revoking} onClose={() => setRevoking(null)} title={`Remove your link to ${revoking?.childName ?? ''}?`} options={[
          { label: 'Remove the link', sub: 'Every open hit is cancelled. They can invite you again later.', danger: true,
            onPress: async () => { if (!revoking) return; try { await api.guardianRevoke(revoking.id); await refresh(); await kids.reload(); await links.reload(); toast('Removed.'); } catch (e: any) { toast(e.message); } } },
          { label: 'Keep it', onPress: () => {} },
        ]} />

        {/* The parent's own account. They signed in with a phone number too, and need the
            same way out, the same help and the same policies as anyone else. */}
        <T v="micro" tone="muted" style={[st.k, { marginTop: space.xl }]}>Your account</T>
        <Card style={{ paddingVertical: 2 }}>
          <Tap onPress={() => router.push('/guardian/link?preview=1')} style={st.row} accessibilityRole="button">
            <View style={{ flex: 1 }}><T v="smallM">How this works</T><T v="meta" tone="muted">What you control and what you see.</T></View>
            <Icon name="chevron-right" size={15} color={t.muted} />
          </Tap>
          {legal && (() => { const L = legal; return (
            <>
              <Tap onPress={() => void WebBrowser.openBrowserAsync(L.support)} style={[st.row, s.rule]} accessibilityRole="link">
                <View style={{ flex: 1 }}><T v="smallM">Help</T><T v="meta" tone="muted">Reach a person. Safety reports same day.</T></View>
                <Icon name="arrow-up-right" size={15} color={t.muted} />
              </Tap>
              <Tap onPress={() => void WebBrowser.openBrowserAsync(L.privacy)} style={[st.row, s.rule]} accessibilityRole="link">
                <View style={{ flex: 1 }}><T v="smallM">Privacy policy</T><T v="meta" tone="muted">Including what we keep about you as a parent.</T></View>
                <Icon name="arrow-up-right" size={15} color={t.muted} />
              </Tap>
              <Tap onPress={() => void WebBrowser.openBrowserAsync(L.terms)} style={[st.row, s.rule]} accessibilityRole="link">
                <View style={{ flex: 1 }}><T v="smallM">Terms of use</T><T v="meta" tone="muted">The rules for everyone on Hits.</T></View>
                <Icon name="arrow-up-right" size={15} color={t.muted} />
              </Tap>
            </>
          ); })()}
        </Card>
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          {demo && (() => { const d = demo; return (
            <Button title="Back to the player view (demo)" kind="line" onPress={async () => { d.switchToPlayer(); await refresh(); router.replace('/(tabs)'); }} />
          ); })()}
          <Button title="Sign out" kind="ghost" icon="log-out" small style={{ alignSelf: 'flex-start' }} onPress={async () => { await api.signOut(); setSession(null); setProfile(null); router.replace('/onboarding/phone'); }} />
          <Tap onPress={() => router.push('/delete-account')} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }} accessibilityRole="button">
            <T v="small" tone="danger">Delete my account</T>
          </Tap>
        </View>
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  strip: { gap: 10, paddingVertical: space.md, paddingRight: 4 },
  badgeText: { color: '#FFFFFF', fontFamily: font.bold, fontSize: 10, lineHeight: 12 },
  k: { marginTop: 24, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 12, gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  remove: { minHeight: hit.min, justifyContent: 'center', alignItems: 'center', marginTop: space.md },
  plusText: { color: '#173D2B', fontFamily: font.bold, fontSize: 10, lineHeight: 13, letterSpacing: 1.4 },
});
const useS = makeStyles(c => ({
  rule: { borderTopWidth: 1, borderTopColor: c.line },
  kid: { width: 112, alignItems: 'center', padding: 12, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  kidOn: { borderColor: c.green, borderWidth: 2, padding: 11 },
  add: { borderStyle: 'dashed' },
  addIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: '#A8371B', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.card },
  plusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: space.md, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, minHeight: hit.row },
  plusRowOn: { borderColor: c.green },
  plusBadge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: '#DFFF4F' },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c.soft, borderRadius: radius.xs, paddingVertical: 10, paddingHorizontal: 12, minHeight: 44 },
}));
