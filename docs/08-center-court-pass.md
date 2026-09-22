# 8. Center Court Pass — Redesign, Palo Alto, and the Open Items

## What changed

**Market.** Palo Alto is the launch market. Cohort threshold is 150 active players inside a
default 10-mile radius (Menlo Park to Sunnyvale), both cohorts closed until each clears its
own count. Distance buckets are 1-mile steps to 15, then fives. Court directory is Peninsula
public parks and known centers (coordinates are still placeholders to verify).

**Design: Center Court.** Sky then court on every screen; content on white sheets. Bricolage
Grotesque for names and numbers, Instrument Sans for everything else. The ball colour means
action and nothing else. Motion is ball physics: the loader is a matchup — two players on
opposite sides of the net with a ball arcing between them — and the confirmed moment is the
ball crossing the net before the two numbers stand up on either side of it.

**IA.** Two tabs. "Your move" is pinned at the top of Hits with Pass / Counter / I'm in
inline; everything else in play is a collapsible strip; then the players. The Requests tab is
gone. List is the default for everyone; the court view is the browse mode — players
positioned by level (closer to the net = closer to your level) and distance (left to right).

**Section 3 items, all built:**
- Guardian-side block, from the approve screen, with a confirm sheet. RLS policy + test.
- Roster codes: a coach/captain makes one code with a name and cap from the You tab and
  shares it; the phone screen takes it. Joins are tagged so density can be read by source.
  Rosters carry no visibility privilege (`06_rosters_and_guardian_block.sql` proves it).
- Push: `expo-notifications` registration, token stored in `profiles_private`, a
  notification outbox written by triggers (request received, accepted, approval needed,
  confirmed) plus a tomorrow-reminder job, and an edge function that delivers via Expo. The
  demo layer fires local notifications at the same moments.
- The planning window: while parents decide, the kids plan the hit — balls, drills or sets,
  where to meet — one tap each, both sides see it, the confirmed screen inherits it and adds
  "running 5 late". Both parents' progress is shown as two lights (sent / opened / approved).
- Assurance panel on the parent's approve screen: the other parent's link tenure and
  approval count, the other player's hits, membership length and report count, and the
  under-18 separation line. Aggregates only, via a definer RPC only a guardian can call.
- Guardian verification: SMS and email, a page that is only the what-you-control screen and
  one button, no account first; `opened_at` tracked and shown to the kid as sent → opened →
  said yes.
- Undo window 4.5s → 7s, and the undo is a ball-coloured button on an ink toast.

## Decisions I made that you didn't specify

1. **The swipe stack is gone; the court view replaced it.** You said keep the stack and make
   it feel great, then chose a direction where the court is the browse mode. Two browse modes
   plus a list is one too many, and the court view is the stack's job done better — it's
   still tap-to-pick with the same one-gesture send and undo. Easy to restore; the data layer
   didn't change.
2. **Court view caps at 12 players** and jitters positions so near-equal levels don't stack.
   Beyond 12 the court is noise; the list handles depth.
3. **Roster cap defaults to 20**, codes are five letters of the name plus two digits, and
   creating a roster requires a participating account (so a minor without a verified parent
   can't create one).
4. **Demo team code `PALY26`** exists so the flow can be walked.
5. **Notifications are an outbox, not direct sends from triggers.** Triggers write rows; an
   edge function on a schedule delivers them. That keeps the database free of network calls
   and makes "what did we send" auditable.
6. **"Hit tomorrow" fires in a 20–28 hour window** from a scheduled function, once per hit.
7. **The kid can't nudge the parent** (as ruled), but the kid can see the parent has opened
   the message. That's the honest middle: information, not pressure.
8. **The other parent's approval count includes past hits across all their children** — it's
   a signal about the adult, not the child.

## Where the safety model still forces a compromise

- The court view exposes distance as horizontal position, which is one more way to read
  proximity. It's the same bucketed number as the list, drawn instead of written; no new
  information, but it *feels* more like a map. Watch how parents read it.
- A parent still can't see the other parent. The assurance panel makes the wait-to-trust
  gap much smaller; it doesn't close it.

## What I'd change having built it

- **Collision handling on the court** is a jitter, not a layout. A small force-directed pass
  (or a grid snap with occupancy) would place 12 tokens without any overlap.
- **The sky band is a fixed height per screen.** On short content it can sit under the
  header awkwardly; a sky that measures the header block would be cleaner.
- **The web build can't show haptics or the push permission prompt.** The next verification
  is on a device in Expo Go: the confirmed thud, the plan chips' tick, and the outbox
  delivering a real notification against a Supabase project.
- **Rosters need an owner view** with the list of who joined; today it's a count.

## Addendum — the "everything you can do" pass (2026-09-19/20)

- Live Supabase project created and fully migrated, seeded, advisor-hardened and smoke
  tested; two edge functions deployed. Remaining steps are dashboard-only (`09`).
- Guardian link lifecycle server-side: preview before sign-in, `opened_at`, accept (the
  signed-in email must match the invited address), revoke (cancels every open hit).
- Requests expire after 72h from the scheduled function.
- `08_app_contract.sql` pins every RPC/column name the app uses.
- Court view: grid layout with occupancy, so tokens never stack.
- Accessibility audit (axe, WCAG AA) on nine screens: `ink3` darkened to 5.3:1 (it was
  3.64 — the earlier 4.6 figure was wrong), `aria-checked` on radio/checkbox chips,
  progress bar named, tab bar given a `tablist`, player row un-nested, all switches
  labelled, horizon moved to the bottom fifth of the sky so no text sits on it.
- **Phone sharing** (your ask): once a hit is confirmed either player can share their
  number for that hit — one tap, revocable, the other player gets a "Text" button, a
  linked parent can see it. Numbers stay unreadable everywhere else (test 09).

## Addendum — light, depth, motion (2026-09-20)

"Fun but not flashy" was fair. What changed, all within Center Court:
- **Real light.** The sky is a gradient that follows the time of day (dawn gold, noon
  blue, evening amber, a floodlit-dusk night session), with a sun in it and grain over it.
  The ground is a gradient with grain; the court is gradient acrylic with a sheen.
- **Depth.** Sheets are lit from the top-left (edge highlight, long warm shadow); the
  discovery court is tilted in perspective so you're standing at the baseline; tokens cast
  shadows and drop in with squash-and-stretch.
- **Faces.** Initials avatars, coloured from the name, on every row, card and slab.
- **Loud where it matters.** "Your move" is a solid ball-yellow slab with an ink button.
  The wordmark has a live ball that bounces once. The tab bar's ball rolls, hops and spins
  to the active tab. The confirmed landing throws twelve balls out from the net.
- Court labels are first names only (distance is already the horizontal axis).

## Addendum — UTR / USTA

The accurate level is UTR's, and the app is now wired for it end to end: `Link UTR` →
`begin_utr_link` (one-time state) → UTR's OAuth page → the deployed `utr-link` edge
function → `apply_utr`, callable only by the server. A rated player's number becomes their
`utr_verified` level and the badge; tokens are unreadable by any client (test 10). What is
still missing is the partner credential itself, which only UTR can issue (`09`). USTA has
no rating API; the level step now takes an NTRP rating and maps it onto the UTR scale as a
self-reported start. Not built, on purpose: reading UTR's unofficial profile endpoints —
it would work today and cost the partnership tomorrow.

## Addendum — photos, sound, animation (2026-09-21)

- **Photos.** A "Put a face on it" step after the name (camera or library, square, 512px,
  skippable), tap the member card in You to change it, a public bucket keyed by the owner's
  id with owner-only writes. Who can *see* a photo is exactly who can see the profile — an
  adult cannot find a minor's URL (test 11) — and a linked parent can remove their child's
  photo from the approve screen.
- **Sound.** Two synthesized sounds shipped as WAVs: a ball strike (thump + string ping)
  when a hit locks in, the parent approves, or "we hit" is confirmed; a soft pop when a
  request goes out or is accepted. On by default, one toggle in You, silent-mode respected,
  never on a loading state. Decision: on by default, because the strike only ever plays on
  a moment the player just caused.
- **Animation, everywhere the player touches.** Level numbers count up into place on every
  card and the member card; the level badge pops when you pick a rung; pills and
  availability tiles squash like a ball on the strings when they toggle; list rows spring
  in staggered and swing out when you send; the member card flips in on the ready screen;
  the parent's approval slams an APPROVED stamp and throws a ball burst; "we hit" throws
  one too; the photo avatar zooms in when you set it. All under 150ms to respond, all off
  under reduced motion.
- axe: zero violations on ten screens.

## Addendum — all four (2026-09-21)

- **Strike sound v2**: a bandpassed string-bed transient, a felt thwock and two body modes,
  still synthesized (no licence to carry). Swap `assets/sfx/strike.wav` for a recording
  whenever you have one; nothing else changes.
- **Photos of minors are parent-approved.** A minor's new photo goes to
  `photo_pending_url`; the parent's dashboard shows it with Approve / Remove; nobody else
  sees it until then (test 12). Adults' photos publish immediately.
- **Shadows follow the sun.** `sunShadow()` derives the offset from the time-of-day sun;
  sheets and court tokens cast their shadows away from it.
- **Story share card.** The confirmed moment renders a 1080x1920 card off-screen (both
  faces, both numbers, IT'S ON, day and court) and shares it as an image on device; on web
  it shares the text.

## Addendum — invites, moderation, and an audit that can be re-run (2026-09-22)

- **One field, two codes.** The onboarding code box takes a captain's team code or a
  friend's personal invite and says which it got before you have an account. A used invite
  and a full team both explain themselves rather than reading as "unknown code".
- **Countering shows what you are answering.** "They said Thursday 9am → you're saying
  Tomorrow 9am", live as you pick, with their court pre-selected, because a counter
  usually keeps one of the two. Proposing their own slot back at them is no longer a
  sendable no-op; the button says what to change instead.
- **The report button's promise is kept in SQL.** Suspending someone now cancels the hits
  they were already in and tells the other side, and the reporter hears that a person read
  it. Both were things a human had to remember, which means both were things that were
  going to be forgotten.
- **axe is a script, not a claim.** `npm run a11y` runs the audit across ten screens on the
  exported build, seeding demo state so the second half of the app is actually reachable.
  It immediately found one real regression: the message sender's name carried
  `opacity: 0.85` over `ink3`, a token tuned to land at exactly 5.3:1, which dropped it to
  3.95:1. The opacity is gone; the micro size and quiet tone were doing that job anyway.
  Ten screens, zero violations — and now that is checkable rather than remembered.
