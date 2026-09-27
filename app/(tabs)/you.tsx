import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { shadow } from '@/lib/shadow';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Field } from '@/ui/Field';
import { Score } from '@/ui/Score';
import { MemberCard } from '@/ui/MemberCard';
import { useToast } from '@/ui/Toast';
import { color, hit, space } from '@/theme/tokens';
import { api, demo } from '@/data';
import * as WebBrowser from 'expo-web-browser';
import { pickPhoto } from '@/lib/photo';
import { loadSoundPref, setSoundEnabled } from '@/lib/sound';
import { OptionSheet } from '@/ui/Sheet';
import { Avatar } from '@/ui/Avatar';
import { useSession } from '@/store/session';
import { TAB_BAR_H } from './_layout';
import { useAsync } from '@/store/useAsync';
import { slotsOf } from '@/data/types';
import { AvailabilityGrid } from '@/ui/Availability';
import { pct, relTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { legal } from '@/lib/links';
import type { Profile, UtrClaim, UtrStatus } from '@/data/types';
import type { StyleProp, ViewStyle } from 'react-native';

// What the utr-link function sends back, in words a player can act on.
const UTR_TROUBLE: Record<string, string> = {
  missing: 'UTR sent us back without a code. Try again.',
  expired: 'That link timed out. Start it again.',
  token: "UTR wouldn't complete the sign-in. Try again in a minute.",
  profile: "We couldn't read your UTR profile. Check your UTR account has a rating.",
  failed: "We got your rating but couldn't save it. Try again.",
};

export default function You() {
  const router = useRouter();
  const toast = useToast();
  const { profile, setProfile, setSession, listMode, setListMode, refresh, tick } = useSession();
  const { data: courts } = useAsync(() => api.courts(), []);
  const rosters = useAsync(() => api.myRosters(), [tick]);
  const invites = useAsync(() => api.myInvites(), [tick]);
  const utr = useAsync(() => api.utrStatus(), [tick]);
  const utrClaim = useAsync(() => api.myUtrClaim(), [tick]);
  const [editingAvail, setEditingAvail] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [sound, setSound] = useState(true);
  React.useEffect(() => { void loadSoundPref().then(setSound); }, []);
  if (!profile) return null;
  const looking = !!profile.lookingToHitUntil && new Date(profile.lookingToHitUntil) > new Date();
  const court = courts?.find(c => c.id === profile.homeCourtId)?.name ?? '—';
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
    try { const r = await api.createRoster(teamName.trim(), 20); setTeamName(''); await rosters.reload(); void Share.share({ message: `Join ${r.name} on Hits. Code ${r.code}. Find hitting partners at your level in Palo Alto.` }).catch(() => {}); }
    catch (e: any) { toast(e.message); } finally { setCreating(false); }
  };

  return (
    <Screen sky={150} extraBottom={TAB_BAR_H}>
      <Centered>
        <Tap onPress={() => setPhotoSheet(true)} accessibilityRole="button" accessibilityLabel="Change your photo" scaleTo={0.985}>
          <MemberCard name={`${profile.displayName} ${profile.lastInitial ?? ''}.`} level={profile.levelValue} verified={profile.levelSource === 'utr_verified'} court={court} roster={profile.rosterName} minor={profile.band === 'minor'} photo={profile.photoUrl} />
        </Tap>
        {profile.photoPendingUrl && <Sheet style={{ marginBottom: space.md }}><T v="smallM">Your new photo is waiting on your parent.</T><T v="small" tone="ink2">They get a text. It goes live the moment they approve it.</T></Sheet>}
        <OptionSheet open={photoSheet} onClose={() => setPhotoSheet(false)} title="Your photo" options={[
          { label: 'Take a photo', onPress: () => guard(async () => { const r = await pickPhoto('camera'); return r ? api.setPhoto(r.base64) : null; }) },
          { label: 'Choose from library', onPress: () => guard(async () => { const r = await pickPhoto('library'); return r ? api.setPhoto(r.base64) : null; }) },
          ...(profile.photoUrl ? [{ label: 'Remove photo', danger: true, onPress: () => guard(() => api.setPhoto(null)) }] : []),
        ]} />

        <UtrCard profile={profile} status={utr.data} claim={utrClaim.data} reload={async () => { await utr.reload(); await utrClaim.reload(); await refresh(); }} toast={toast} />

        <Sheet accent={looking} style={{ paddingVertical: 4, marginBottom: space.md }}>
          <Toggle title="Looking to hit this week" value={looking} onChange={setLooking}
                  note="Puts you at the net for players near your level. Expires on its own." />
        </Sheet>

        {profile.band === 'minor' && (
          <Sheet style={s.row}>
            <View style={{ flex: 1 }}>
              <T v="bodyM">{profile.guardianVerified ? 'Parent linked' : profile.guardianOpenedAt ? 'Your parent opened the link' : profile.guardianPending ? 'Sent to your parent' : 'No parent linked'}</T>
              <T v="small" tone="ink2">{profile.guardianVerified ? 'They approve each meetup. Nothing else changes.' : 'Reaching out unlocks once they say yes.'}</T>
            </View>
            {!profile.guardianVerified && !profile.guardianPending && <Button title="Add" small onPress={() => router.push('/onboarding/guardian')} />}
          </Sheet>
        )}

        <Sheet style={{ marginBottom: space.md }}>
          <View style={s.stats}>
            <View style={s.stat}><T v="h1" tone="court">{profile.hitsConfirmed}</T><T v="micro" tone="ink3">Hits played</T></View>
            <View style={s.stat}><T v="h1" tone="court">{pct(profile.responseRate) ?? '—'}</T><T v="micro" tone="ink3">Reply rate</T></View>
            <View style={s.stat}><T v="h1" tone="court">{pct(profile.acceptRate) ?? '—'}</T><T v="micro" tone="ink3">Say yes</T></View>
          </View>
          <T v="small" tone="ink3" style={{ marginTop: space.sm }}>Everyone sees these. Always reply. Even a no counts.</T>
        </Sheet>

        {/* Invites: one code brings one friend. Attribution, never a privilege -- redeeming
            one does not make anybody visible to anybody. */}
        <Sheet style={{ marginBottom: space.md, gap: space.sm }}>
          <T v="h2">Bring a friend</T>
          <T v="small" tone="ink2">A code for one person. They see your name when they type it in, and you hear when they join.</T>
          {(invites.data ?? []).filter(i => !i.redeemed).map(i => (
            <Tap key={i.code} onPress={() => shareInvite(i.code)} style={s.roster} accessibilityRole="button" accessibilityLabel={`Share your invite code ${i.code}`}>
              <View style={{ flex: 1 }}><T v="bodyM">Open invite</T><T v="small" tone="ink2">Tap to send it again</T></View>
              <Pill label={i.code} tone="ball" />
            </Tap>
          ))}
          {landed > 0 && <T v="small" tone="court">{landed === 1 ? 'One player joined on your invite.' : `${landed} players joined on your invites.`}</T>}
          <Button title="Make an invite" small onPress={invite} loading={inviting} style={{ alignSelf: 'flex-start' }} />
        </Sheet>

        {/* Rosters: one code brings a whole team. */}
        <Sheet style={{ marginBottom: space.md, gap: space.sm }}>
          <T v="h2">Bring your team</T>
          <T v="small" tone="ink2">Make a code for your team, academy group or club ladder. Everyone who joins with it counts toward opening the courts.</T>
          {(rosters.data ?? []).map(r => (
            <Tap key={r.id} onPress={() => void Share.share({ message: `Join ${r.name} on Hits. Code ${r.code}.` }).catch(() => {})} style={s.roster} accessibilityRole="button">
              <View style={{ flex: 1 }}><T v="bodyM">{r.name}</T><T v="small" tone="ink2">{r.joined} of {r.cap} joined</T></View>
              <Pill label={r.code} tone="ball" />
            </Tap>
          ))}
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field value={teamName} onChangeText={setTeamName} placeholder="Paly Girls Varsity" maxLength={40} /></View>
            <Button title="Make a code" small onPress={createTeam} loading={creating} disabled={teamName.trim().length < 2} />
          </View>
        </Sheet>

        <Sheet style={{ paddingVertical: 4, marginBottom: space.md }}>
          <Tap onPress={() => setEditingAvail(e => !e)} style={s.line} accessibilityRole="button">
            <View style={{ flex: 1 }}><T v="bodyM">Usually free</T><T v="small" tone="ink2">{slotsOf(profile.availabilityMask).join(', ') || 'Not set'}</T></View>
            <T v="smallM" tone="court">{editingAvail ? 'Done' : 'Edit'}</T>
          </Tap>
          {editingAvail && (
            <View style={{ paddingBottom: space.lg }}>
              <AvailabilityGrid mask={profile.availabilityMask} onToggle={toggleSlot} />
            </View>
          )}
          <Toggle title="Sound" value={sound} onChange={v => { setSound(v); void setSoundEnabled(v); }}
                  note="One ball strike when a hit locks in. Off in silent mode anyway."
                  style={{ borderTopWidth: 1, borderTopColor: color.hair }} />
          <Toggle title="Browse on the court" value={!listMode} onChange={v => setListMode(!v)}
                  note="Players placed by level and distance, instead of the list."
                  style={{ borderTopWidth: 1, borderTopColor: color.hair }} />
          <Tap onPress={() => router.push('/guardian/link')} style={[s.line, { borderTopWidth: 1, borderTopColor: color.hair }]} accessibilityRole="button">
            <View style={{ flex: 1 }}><T v="bodyM">What a parent sees</T><T v="small" tone="ink2">The page they get when you add them.</T></View>
            <T v="smallM" tone="court">View</T>
          </Tap>
          {legal && (() => { const L = legal; return (
            <>
              <Tap onPress={() => void WebBrowser.openBrowserAsync(L.support)} style={[s.line, { borderTopWidth: 1, borderTopColor: color.hair }]} accessibilityRole="link">
                <View style={{ flex: 1 }}><T v="bodyM">Help</T><T v="small" tone="ink2">Reach a person. Safety reports same day.</T></View>
                <T v="smallM" tone="court">Open</T>
              </Tap>
              <Tap onPress={() => void WebBrowser.openBrowserAsync(L.privacy)} style={[s.line, { borderTopWidth: 1, borderTopColor: color.hair }]} accessibilityRole="link">
                <View style={{ flex: 1 }}><T v="bodyM">Privacy policy</T><T v="small" tone="ink2">What we keep, who sees it, how to delete it.</T></View>
                <T v="smallM" tone="court">Open</T>
              </Tap>
              <Tap onPress={() => void WebBrowser.openBrowserAsync(L.terms)} style={[s.line, { borderTopWidth: 1, borderTopColor: color.hair }]} accessibilityRole="link">
                <View style={{ flex: 1 }}><T v="bodyM">Terms of use</T><T v="small" tone="ink2">The rules, and what Hits is not responsible for.</T></View>
                <T v="smallM" tone="court">Open</T>
              </Tap>
            </>
          ); })()}
        </Sheet>

        <View style={{ gap: space.md }}>
          {demo && (() => { const d = demo; return (
            <Sheet style={{ gap: space.md }}>
              <T v="micro" tone="ink3">Demo controls</T>
              <Toggle title="Cohort open" value={d.cohortOpen} onChange={v => { d.setCohortOpen(v); }}
                      note="Off shows the countdown state." />
              {profile.band === 'minor' && <Button title="Open the parent's view" kind="line" onPress={async () => { d.switchToGuardian(); await refresh(); router.replace('/guardian'); }} />}
              <Button title="Reset demo" kind="ghost" onPress={async () => { await d.reset(); setSession(null); setProfile(null); router.replace('/onboarding/phone'); }} small />
            </Sheet>
          ); })()}
          <Button title="Sign out" kind="ghost" onPress={async () => { await api.signOut(); setSession(null); setProfile(null); router.replace('/onboarding/phone'); }} small />
          {/* Not a ghost button next to Sign out, because the two are not the same size of
              decision and should not look alike. Its own row, its own colour, and the
              screen behind it does the explaining. */}
          <Tap onPress={() => router.push('/delete-account')} style={s.danger} accessibilityRole="button">
            <T v="small" tone="danger">Delete my account</T>
          </Tap>
        </View>
      </Centered>
    </Screen>
  );
}
// A settings row where the whole row is the switch. Reanimated's Switch renders 40x20,
// which is half the height a thumb needs, and nobody aims for the toggle anyway -- they
// tap the words. The Switch keeps its own label so screen readers still announce state.
// The picture of a toggle. 52x32 with a 26px thumb, which is a comfortable size to look at
// and irrelevant to touch, because the whole row is the target.
function Knob({ on }: { on: boolean }) {
  const x = useSharedValue(on ? 22 : 2);
  useEffect(() => { x.value = withSpring(on ? 22 : 2, { damping: 18, stiffness: 260 }); }, [on, x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View pointerEvents="none" style={[s.track, on && { backgroundColor: color.court }]}>
      <Animated.View style={[s.knob, a]} />
    </View>
  );
}

function Toggle({ title, note, value, onChange, style }:
  { title: string; note?: string; value: boolean; onChange: (v: boolean) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Tap onPress={() => onChange(!value)} style={[s.line, style]} accessibilityRole="switch"
         accessibilityState={{ checked: value }} aria-checked={value} accessibilityLabel={title}>
      <View style={{ flex: 1 }}>
        <T v="bodyM">{title}</T>
        {note ? <T v="small" tone="ink2">{note}</T> : null}
      </View>
      {/* Drawn, not a real Switch. React Native Web's Switch renders a focusable checkbox,
          and a focusable control inside a control that is itself a switch is a genuine a11y
          failure (nested-interactive) that aria-hidden does not fix -- hiding something
          does not take it out of the tab order. The row carries the role and the state; this
          is just the picture of it. */}
      <Knob on={value} />
    </Tap>
  );
}

// The UTR card. Four states, all of them true statements:
//   not linked        -> the pitch
//   linked + rated    -> the badge, the number, when we last checked
//   linked, no rating -> UTR knows you, it has not rated you yet
//   not yet available -> we are honest that the partner API is not live
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
      // The callback says what happened. Without reading it, a failure looked exactly
      // like a success.
      const outcome = r.type === 'success' ? new URL(r.url).searchParams.get('utr') : null;
      await reload();
      if (outcome === 'linked') { haptic.confirmed(); toast('UTR linked. Your level comes from your results now.'); }
      else if (outcome) toast(UTR_TROUBLE[outcome] ?? "UTR didn't finish. Try again.");
    } catch (e: any) { toast(e?.message ?? "UTR didn't finish. Try again."); }
    finally { setBusy(false); }
  };

  const unlink = async () => {
    setBusy(true);
    try { await api.unlinkUtr(); await reload(); toast('UTR unlinked. Your level is self-reported again.'); }
    catch (e: any) { toast(e?.message ?? "Couldn't unlink."); }
    finally { setBusy(false); }
  };

  // Verified by a person rather than by UTR's API. Same badge, different provenance.
  if (reviewed) {
    return (
      <Sheet accent style={[s.row, { alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <T v="bodyM">UTR verified</T>
          <T v="small" tone="ink2">We checked your UTR profile ourselves. Your level carries the badge.</T>
        </View>
        <Score value={profile.levelValue} size="h1" verified tone="court" />
      </Sheet>
    );
  }

  if (!status) {
    // Two roads to the same badge. The OAuth one only appears once we have Engage API
    // access; until then the review path is the real one, so it leads.
    const waiting = claim?.state === 'pending';
    return (
      <Sheet style={{ marginBottom: space.md, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <T v="bodyM">{waiting ? "We're checking your UTR" : 'Verify your level'}</T>
            <T v="small" tone="ink2">
              {waiting
                ? 'A person is confirming your UTR profile. Usually within a day.'
                : claim?.state === 'rejected'
                  ? "We couldn't verify the last one. Send it again with the right link."
                  : 'A verified level is the one other players trust. Send us your UTR and we check it against your profile.'}
            </T>
          </View>
          {claim && <Score value={claim.claimedRating} size="h1" tone="court" />}
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button title={waiting ? 'See your claim' : 'Get verified'} small kind="court" onPress={() => router.push('/verify-utr')} />
          <Button title="Link UTR account" small kind="line" onPress={link} loading={busy} />
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet accent={rated} style={{ marginBottom: space.md, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <T v="bodyM">{rated ? 'UTR verified' : 'UTR linked'}</T>
          <T v="small" tone="ink2">
            {rated
              ? `Your level is your UTR${status.syncedAt ? `, checked ${relTime(status.syncedAt)} ago` : ''}. It updates on its own.`
              : status.ratingStatus === 'projected'
                ? 'UTR has you projected, not rated yet. The badge arrives with your rating.'
                : 'UTR knows your account but has not rated you yet. Play a few rated matches.'}
          </T>
        </View>
        {status.rating != null && <Score value={status.rating} size="h1" verified={rated} tone="court" />}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button title="Refresh" kind="line" small onPress={link} loading={busy} />
        <Button title="Unlink" kind="ghost" small onPress={unlink} />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: 2 },
  roster: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderTopWidth: 1, borderTopColor: color.hair, paddingVertical: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: hit.row, paddingVertical: space.md },
  danger: { minHeight: hit.min, alignItems: 'center', justifyContent: 'center' },
  track: { width: 52, height: 32, borderRadius: 16, backgroundColor: color.paper3, justifyContent: 'center' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.paper, ...shadow({ y: 1, blur: 3, opacity: 0.25 }) },
});
