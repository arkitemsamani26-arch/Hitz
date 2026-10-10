// Club card. The card, then the handful of things about you that other players see, then
// the account.
import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Field } from '@/ui/Field';
import { Score } from '@/ui/Score';
import { Icon } from '@/ui/Icon';
import { MemberCard } from '@/ui/MemberCard';
import { OptionSheet } from '@/ui/Sheet';
import { AvailabilityGrid } from '@/ui/Availability';
import { useToast } from '@/ui/Toast';
import { hit, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api, demo } from '@/data';
import { pickPhoto } from '@/lib/photo';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { slotsSummary } from '@/data/types';
import { relTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { legal } from '@/lib/links';
import type { Profile, UtrClaim, UtrStatus } from '@/data/types';
import type { StyleProp, ViewStyle } from 'react-native';

const PREFERS = ['Rally & drills', 'Practice sets', 'Match play', 'Drills, then sets', 'Anything, honestly'];

// What the utr-link function sends back, in words a player can act on.
const UTR_TROUBLE: Record<string, string> = {
  missing: 'UTR sent us back without a code. Try again.',
  expired: 'That link timed out. Start it again.',
  token: "UTR wouldn't complete the sign-in. Try again in a minute.",
  profile: "We couldn't read your UTR profile. Check your UTR account has a rating.",
  failed: "We got your rating but couldn't save it. Try again.",
};

export default function ClubCard() {
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { profile, setProfile, setSession, refresh, tick } = useSession();
  const { data: courts } = useAsync(() => api.courts(), []);
  const market = useAsync(() => api.marketStatus(), []);
  const rosters = useAsync(() => api.myRosters(), [tick]);
  const invites = useAsync(() => api.myInvites(), [tick]);
  const utr = useAsync(() => api.utrStatus(), [tick]);
  const utrClaim = useAsync(() => api.myUtrClaim(), [tick]);
  const [editingAvail, setEditingAvail] = useState(false);
  const [sheet, setSheet] = useState<null | 'prefers' | 'court' | 'photo'>(null);
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  if (!profile) return null;
  const looking = !!profile.lookingToHitUntil && new Date(profile.lookingToHitUntil) > new Date();
  const court = courts?.find(c => c.id === profile.homeCourtId)?.name ?? 'Not set';
  const area = market.data?.marketName ?? 'Palo Alto';
  const verified = profile.levelSource === 'utr_verified';
  // Every one of these can fail. Failing silently made the control snap back with no
  // explanation, which reads as the app being broken.
  const guard = async (fn: () => Promise<Profile | null>) => {
    try { const p = await fn(); if (p) setProfile(p); }
    catch (e: any) { haptic.warn(); toast(e?.message ?? "That didn't save. Try again."); }
  };
  const setLooking = (v: boolean) => guard(() => api.setLooking(v ? 7 : null));
  const toggleSlot = (bit: number) => guard(() => api.updateProfile({ availabilityMask: profile.availabilityMask ^ bit }));
  const shareInvite = (code: string) =>
    void Share.share({ message: `Come hit with me on Hits. Use my code ${code} when you sign up. Players at your level, on courts near you.` }).catch(() => {});
  const invite = async () => {
    setInviting(true);
    try { const i = await api.issueInvite(); await invites.reload(); shareInvite(i.code); }
    catch (e: any) { toast(e.message); } finally { setInviting(false); }
  };
  const landed = (invites.data ?? []).filter(i => i.redeemed).length;
  const createTeam = async () => {
    if (teamName.trim().length < 2) return;
    setCreating(true);
    try { const r = await api.createRoster(teamName.trim(), 20); setTeamName(''); await rosters.reload(); void Share.share({ message: `Join ${r.name} on Hits. Code ${r.code}. Find hitting partners at your level in ${area}.` }).catch(() => {}); }
    catch (e: any) { toast(e.message); } finally { setCreating(false); }
  };
  const availText = slotsSummary(profile.availabilityMask);

  return (
    <Screen>
      <Centered>
        <T v="eyebrow" tone="muted" style={{ marginTop: 10 }}>The clubhouse</T>
        <T v="display" style={st.h} accessibilityRole="header">Your game.{'\n'}<T v="display" italic>Your people.</T></T>
        <T v="small" tone="muted" style={st.sub}>A little identity. A lot more tennis.</T>

        <MemberCard name={`${profile.displayName} ${profile.lastInitial ?? ''}.`.trim()} level={profile.levelValue} source={profile.levelSource} verified={verified} area={area}
          line={profile.prefers ? `Here for ${profile.prefers.toLowerCase()}.` : 'Here for a good hit.'} />

        {/* The rows under the card: what the card says, and the few facts that feed matching. */}
        <Row k="Typical availability" v={availText} onPress={() => setEditingAvail(e => !e)} expanded={editingAvail} />
        {editingAvail && <View style={{ paddingVertical: space.lg }}><AvailabilityGrid mask={profile.availabilityMask} onToggle={toggleSlot} /></View>}
        <Row k="Looking for" v={profile.prefers ?? 'Not set'} onPress={() => setSheet('prefers')} />
        <Row k="Home court" v={court} onPress={() => setSheet('court')} />
        <ToggleRow k="Looking to hit this week" v={looking} onChange={setLooking} note="Puts you at the top for players near your level. Expires on its own." />
        <Row k="Photo" v={profile.photoUrl ? 'Added' : profile.photoPendingUrl ? 'Waiting on your parent' : 'None'} onPress={() => setSheet('photo')} />
        {profile.band === 'minor' && (
          <Row k="Parent" v={profile.guardianVerified ? 'Linked' : profile.guardianOpenedAt ? 'Opened the link' : profile.guardianPending ? 'Sent' : 'Not linked'}
            onPress={!profile.guardianVerified && !profile.guardianPending ? () => router.push('/onboarding/guardian') : undefined} />
        )}
        <T v="meta" tone="muted" style={{ marginTop: 12, lineHeight: 18 }}>
          {verified ? 'Rating verified against your UTR profile.' : 'Self-reported rating. Other players see it labelled that way.'}
        </T>

        <UtrCard profile={profile} status={utr.data} claim={utrClaim.data} reload={async () => { await utr.reload(); await utrClaim.reload(); await refresh(); }} toast={toast} />

        {/* Invites: one code brings one friend. Attribution, never a privilege. */}
        <T v="micro" tone="muted" style={st.k}>Bring a friend</T>
        <Card style={{ gap: space.sm }}>
          <T v="small" tone="muted">A code for one person. They see your name when they type it in, and you hear when they join.</T>
          {(invites.data ?? []).filter(i => !i.redeemed).map(i => (
            <Tap key={i.code} onPress={() => shareInvite(i.code)} style={s.line} accessibilityRole="button" accessibilityLabel={`Share your invite code ${i.code}`}>
              <View style={{ flex: 1 }}><T v="smallM">Open invite</T><T v="meta" tone="muted">Tap to send it again</T></View>
              <Pill label={i.code} />
            </Tap>
          ))}
          {landed > 0 && <T v="small" tone="green">{landed === 1 ? 'One player joined on your invite.' : `${landed} players joined on your invites.`}</T>}
          <Button title="Make an invite" kind="line" small onPress={invite} loading={inviting} style={{ alignSelf: 'flex-start' }} />
        </Card>

        {/* Rosters: one code brings a whole team. */}
        <T v="micro" tone="muted" style={st.k}>Bring your team</T>
        <Card style={{ gap: space.sm }}>
          <T v="small" tone="muted">Make a code for your team, academy group or club ladder. Everyone who joins with it counts toward opening the courts.</T>
          {(rosters.data ?? []).map(r => (
            <Tap key={r.id} onPress={() => void Share.share({ message: `Join ${r.name} on Hits. Code ${r.code}.` }).catch(() => {})} style={s.line} accessibilityRole="button" accessibilityLabel={`Share the code for ${r.name}`}>
              <View style={{ flex: 1 }}><T v="smallM">{r.name}</T><T v="meta" tone="muted">{r.joined} of {r.cap} joined</T></View>
              <Pill label={r.code} />
            </Tap>
          ))}
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field value={teamName} onChangeText={setTeamName} placeholder="Paly Girls Varsity" maxLength={40} accessibilityLabel="Team name" /></View>
            <Button title="Make a code" kind="line" small onPress={createTeam} loading={creating} disabled={teamName.trim().length < 2} />
          </View>
        </Card>

        <T v="micro" tone="muted" style={st.k}>Account</T>
        <Card style={{ paddingVertical: 2 }}>
          <Link k="What a parent sees" v="The page they get when you add them." onPress={() => router.push('/guardian/link')} first />
          {legal && (() => { const L = legal; return (
            <>
              <Link k="Help" v="Reach a person. Safety reports same day." onPress={() => void WebBrowser.openBrowserAsync(L.support)} link />
              <Link k="Privacy policy" v="What we keep, who sees it, how to delete it." onPress={() => void WebBrowser.openBrowserAsync(L.privacy)} link />
              <Link k="Terms of use" v="The rules, and what Hits is not responsible for." onPress={() => void WebBrowser.openBrowserAsync(L.terms)} link />
            </>
          ); })()}
        </Card>

        <View style={{ gap: space.md, marginTop: space.xl }}>
          {demo && (() => { const d = demo; return (
            <Card style={{ gap: space.md }}>
              <T v="micro" tone="muted">Demo controls</T>
              <ToggleRow k="Cohort open" v={d.cohortOpen} onChange={v => { d.setCohortOpen(v); }} note="Off shows the waiting state." flat />
              {profile.band === 'minor' && <Button title="Open the parent's view" kind="line" onPress={async () => { d.switchToGuardian(); await refresh(); router.replace('/guardian'); }} />}
              <Button title="Design preview with sample data" kind="line" onPress={() => router.push('/preview')} />
              <Button title="Reset demo" kind="ghost" onPress={async () => { await d.reset(); setSession(null); setProfile(null); router.replace('/onboarding/phone'); }} small />
            </Card>
          ); })()}
          <Button title="Sign out" kind="ghost" icon="log-out" onPress={async () => { await api.signOut(); setSession(null); setProfile(null); router.replace('/onboarding/phone'); }} small style={{ alignSelf: 'flex-start' }} />
          <Tap onPress={() => router.push('/delete-account')} style={st.danger} accessibilityRole="button">
            <T v="small" tone="danger">Delete my account</T>
          </Tap>
        </View>

        <OptionSheet open={sheet === 'prefers'} onClose={() => setSheet(null)} title="What are you usually after?" options={[
          ...PREFERS.map(p => ({ label: p, onPress: () => guard(() => api.updateProfile({ prefers: p })) })),
          ...(profile.prefers ? [{ label: 'Clear it', danger: true, onPress: () => guard(() => api.updateProfile({ prefers: null })) }] : []),
        ]} />
        <OptionSheet open={sheet === 'court'} onClose={() => setSheet(null)} title="Your home court. Never an address."
          options={(courts ?? []).map(c => ({ label: c.name, sub: [c.access === 'club' ? 'Club' : 'Public', c.indoor ? 'Indoor' : 'Outdoor', c.distanceBucket].filter(Boolean).join(' · '), onPress: () => guard(() => api.updateProfile({ homeCourtId: c.id })) }))} />
        <OptionSheet open={sheet === 'photo'} onClose={() => setSheet(null)} title={profile.band === 'minor' ? 'Your photo. Your parent sees it before anyone else does.' : 'Your photo'} options={[
          { label: 'Take a photo', onPress: () => guard(async () => { const r = await pickPhoto('camera'); return r ? api.setPhoto(r.base64) : null; }) },
          { label: 'Choose from library', onPress: () => guard(async () => { const r = await pickPhoto('library'); return r ? api.setPhoto(r.base64) : null; }) },
          ...(profile.photoUrl ? [{ label: 'Remove photo', danger: true, onPress: () => guard(() => api.setPhoto(null)) }] : []),
        ]} />
      </Centered>
    </Screen>
  );
}

// The reference's member rows: a muted key on the left, the value on the right, a rule
// beneath. Tappable rows get a chevron and are the only thing on the screen that moves.
function Row({ k, v, onPress, expanded }: { k: string; v: string; onPress?: () => void; expanded?: boolean }) {
  const t = useTheme();
  const s = useS();
  const inner = (
    <>
      <T v="small" tone="muted" style={{ flexShrink: 0 }}>{k}</T>
      <T v="small" style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>{v}</T>
      {onPress && <Icon name="chevron-right" size={15} color={t.muted} style={expanded ? { transform: [{ rotate: '90deg' }] } : undefined} />}
    </>
  );
  if (!onPress) return <View style={s.row}>{inner}</View>;
  return <Tap onPress={onPress} style={s.row} accessibilityRole="button" accessibilityLabel={`${k}: ${v}. Change.`} accessibilityState={expanded === undefined ? undefined : { expanded }}>{inner}</Tap>;
}

function Link({ k, v, onPress, link, first }: { k: string; v: string; onPress: () => void; link?: boolean; first?: boolean }) {
  const t = useTheme();
  const s = useS();
  return (
    <Tap onPress={onPress} style={[s.line, !first && s.lineRule]} accessibilityRole={link ? 'link' : 'button'}>
      <View style={{ flex: 1 }}><T v="smallM">{k}</T><T v="meta" tone="muted">{v}</T></View>
      <Icon name={link ? 'arrow-up-right' : 'chevron-right'} size={15} color={t.muted} />
    </Tap>
  );
}

// The picture of a switch, drawn, so the row itself can be the control. 44 by 26.
function Knob({ on }: { on: boolean }) {
  const s = useS();
  const x = useSharedValue(on ? 20 : 2);
  React.useEffect(() => { x.value = withTiming(on ? 20 : 2, { duration: 160 }); }, [on, x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View pointerEvents="none" style={[s.track, on && s.trackOn]}>
      <Animated.View style={[s.knob, on && s.knobOn, a]} />
    </View>
  );
}

function ToggleRow({ k, v, onChange, note, flat, style }:
  { k: string; v: boolean; onChange: (v: boolean) => void; note?: string; flat?: boolean; style?: StyleProp<ViewStyle> }) {
  const s = useS();
  return (
    <Tap onPress={() => onChange(!v)} style={[flat ? s.flatRow : s.row, style]} accessibilityRole="switch"
         accessibilityState={{ checked: v }} aria-checked={v} accessibilityLabel={k}>
      <View style={{ flex: 1 }}>
        <T v={flat ? 'smallM' : 'small'} tone={flat ? 'ink' : 'muted'}>{k}</T>
        {note ? <T v="meta" tone="muted">{note}</T> : null}
      </View>
      <Knob on={v} />
    </Tap>
  );
}

// The rating source. Four states, all of them true statements.
function UtrCard({ profile, status, claim, reload, toast }:
  { profile: Profile; status: UtrStatus | null; claim: UtrClaim | null; reload: () => Promise<void>; toast: (m: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const rated = status?.ratingStatus === 'rated' && profile.levelSource === 'utr_verified';
  const reviewed = !status && profile.levelSource === 'utr_verified';

  const link = async () => {
    setBusy(true);
    try {
      const url = await api.beginUtrLink();
      if (!url) { toast('UTR linking opens the moment our Engage API access is approved.'); return; }
      const r = await WebBrowser.openAuthSessionAsync(url, 'hits://you');
      const outcome = r.type === 'success' ? new URL(r.url).searchParams.get('utr') : null;
      await reload();
      if (outcome === 'linked') { haptic.confirmed(); toast('UTR linked. Your rating comes from your results now.'); }
      else if (outcome) toast(UTR_TROUBLE[outcome] ?? "UTR didn't finish. Try again.");
    } catch (e: any) { toast(e?.message ?? "UTR didn't finish. Try again."); }
    finally { setBusy(false); }
  };
  const unlink = async () => {
    setBusy(true);
    try { await api.unlinkUtr(); await reload(); toast('UTR unlinked. Your rating is self-reported again.'); }
    catch (e: any) { toast(e?.message ?? "Couldn't unlink."); }
    finally { setBusy(false); }
  };

  let body: React.ReactNode;
  if (reviewed) {
    body = (
      <View style={st.utrRow}>
        <View style={{ flex: 1 }}><T v="smallM">Verified by a person</T><T v="meta" tone="muted">We checked your UTR profile ourselves. Your rating carries the label.</T></View>
        <Score value={profile.levelValue} source="utr_verified" />
      </View>
    );
  } else if (!status) {
    const waiting = claim?.state === 'pending';
    body = (
      <>
        <View style={st.utrRow}>
          <View style={{ flex: 1 }}>
            <T v="smallM">{waiting ? "We're checking your UTR" : 'Verify your rating'}</T>
            <T v="meta" tone="muted">
              {waiting ? 'A person is confirming your UTR profile. Usually within a day.'
                : claim?.state === 'rejected' ? "We couldn't verify the last one. Send it again with the right link."
                : 'A verified rating is the one other players trust. Send us your UTR and we check it against your profile.'}
            </T>
          </View>
          {claim && <Score value={claim.claimedRating} source="utr_self" />}
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button title={waiting ? 'See your claim' : 'Get verified'} small onPress={() => router.push('/verify-utr')} />
          <Button title="Link UTR account" small kind="line" onPress={link} loading={busy} />
        </View>
      </>
    );
  } else {
    body = (
      <>
        <View style={st.utrRow}>
          <View style={{ flex: 1 }}>
            <T v="smallM">{rated ? 'Verified through UTR' : 'UTR linked'}</T>
            <T v="meta" tone="muted">
              {rated ? `Your rating is your UTR${status.syncedAt ? `, checked ${relTime(status.syncedAt)} ago` : ''}. It updates on its own.`
                : status.ratingStatus === 'projected' ? 'UTR has you projected, not rated yet. The label arrives with your rating.'
                : 'UTR knows your account but has not rated you yet. Play a few rated matches.'}
            </T>
          </View>
          {status.rating != null && <Score value={status.rating} verified={rated} source={rated ? 'utr_verified' : 'utr_self'} />}
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button title="Refresh" kind="line" small onPress={link} loading={busy} />
          <Button title="Unlink" kind="ghost" small onPress={unlink} />
        </View>
      </>
    );
  }
  return (
    <>
      <T v="micro" tone="muted" style={st.k}>Rating source</T>
      <Card style={{ gap: space.md }}>{body}</Card>
    </>
  );
}

const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 12 },
  sub: { marginBottom: 24, lineHeight: 21 },
  k: { marginTop: 24, marginBottom: 10 },
  utrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  danger: { minHeight: hit.min, alignItems: 'center', justifyContent: 'center' },
});
const useS = makeStyles(c => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17, minHeight: 56, borderBottomWidth: 1, borderBottomColor: c.line },
  flatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: hit.min },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm },
  lineRule: { borderTopWidth: 1, borderTopColor: c.line },
  track: { width: 44, height: 26, borderRadius: 13, backgroundColor: c.line, justifyContent: 'center' },
  trackOn: { backgroundColor: c.green },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.card },
  knobOn: { backgroundColor: c.greenText },
}));
