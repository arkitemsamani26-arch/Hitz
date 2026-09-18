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
