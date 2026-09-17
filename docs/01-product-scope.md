# 1. Product Scope — MVP vs. Full Vision

## The thing that actually has to be proven

The risk in Hits is not "can we build a feed." It's **liquidity**: on the day a user
opens the app, are there enough real, responsive players at their level within driving
distance that the app returns something worth acting on? A perfect app with four players
in your radius is a dead app.

Everything below is shaped by that. The MVP is not "the smallest set of screens" — it's
"the smallest set of screens that can tell us whether the loop closes in a dense
market."

### The one metric

**Confirmed hits per active user per month.** Not signups, not DAU, not messages sent.
A hit that both sides confirmed happened. If that number is above ~1.5 in a seeded
market, Hits works. Below 0.5, no amount of design saves it.

Secondary diagnostics: request→accept rate, time-to-first-reply, % of users who get a
reply at all (the loneliness metric — this is the one that kills marketplaces quietly).

---

## MVP — the core loop only

Ship to **one seeded market** (see "Cold start" below), invite-only.

### In scope

**1. Onboarding + identity**
- Phone number sign-in (OTP). Phone verification from day one — it's the cheapest real
  barrier to fake accounts.
- Date of birth (hard gate — see `04-safety-by-design.md`). Under 13 blocked entirely.
- Level: self-reported UTR, or a guided estimator ("what level do you play?" → NTRP-ish
  ladder → mapped to a UTR band) for players without one. Optional free-text "my UTR is
  X" with a `verified: false` flag.
- Home court: picked from a curated courts directory, **not** an address.
- Availability: coarse tags only — weekday mornings / weekday evenings / weekend. Not a
  calendar. Calendars are where scheduling apps go to die.

**2. Discovery feed**
- List of nearby players, default sort by `|their level − my level|` ascending, then
  distance. Skill proximity first is the whole thesis: the best player nearby is the
  *wrong* recommendation.
- Filters: radius, level range, availability tag.
- Card shows: first name + last initial, photo, level (with verified badge or not),
  approximate distance ("~4 mi"), home court, availability tags, responsiveness hint.

**3. Hit request**
- Tap a player → pick a day window + court + optional one-liner → send.
- Recipient accepts / declines / counters (counter = change day or court, one tap).
- On accept, a lightweight thread opens. Threads are scoped to that hit, not a permanent
  inbox.
- Requests expire (72h) so the feed doesn't fill with zombies.

**4. Confirm + close the loop**
- After the hit window passes, both sides get "Did you hit?" → yes/no.
- Yes bumps a public "hits played" count and the responsiveness signal. This is the
  data that makes the recommendations good later, so it has to exist in v1.

**5. Safety primitives** — block, report, approximate location, guardian linking for
minors. Non-negotiable, day one. Details in `04`.

**6. Invite mechanic**
- Closed beta by invite code. Every user gets 5 codes.
- "Invite a hitting partner" flow that shares a code with a prefilled text.
- This is **not** primarily a growth gimmick — it's the density mechanism. Codes
  propagate along real tennis networks (teams, clubs, junior circuits), which is exactly
  how you get local liquidity instead of a thin national spread.

### Explicitly out of MVP

| Cut | Why |
| --- | --- |
| Paid Hit tab | Different trust model, different safety model, payments. Needs the free loop working first. |
| In-app payments | See `05`. |
| "Recommended For You" as a smart tab | The ranking needs behavioral data (responsiveness, accept rates) that only exists after v1 runs. In MVP the default sort *is* the recommendation. |
| Full chat inbox | Threads are per-hit. A general DM surface invites moderation load with no loop value. |
| Streaks / badges / gamification | Deliberate. See below. |
| Reviews & ratings of players | Rating people is a trust minefield; the "did you hit?" confirmation carries most of the signal at a fraction of the risk. |
| Groups, doubles, ladders | Real demand, wrong order. |
| Android + iOS + web | Pick one platform for beta (iOS, given the junior/college demographic) unless the seed market says otherwise. |

---

## Full vision (post-MVP, roughly in order)

**Phase 2 — make it smart**
- **Recommended For You**: ranked by a blend of skill compatibility (gaussian on level
  delta, not nearest-neighbor), proximity, availability overlap, and *responsiveness*.
  Surfacing three great options beats surfacing forty mediocre ones. Cap the tab at 3–5
  cards — scarcity is the feature.
- UTR account linking via the Engage API (see `05`) → verified badges, real ratings.
- Availability overlap matching ("you're both free Saturday morning").

**Phase 3 — Paid Hits**
- Separate tab, 18+ on both sides in v1 (minors buying sessions from adults is a
  materially different safety product — it needs guardian-mediated booking, and probably
  coach credential verification, before it ships).
- Rate, level, distance, session history, reviews (reviews make sense here: it's a
  transaction, not a friendship).
- Payments: start "arrange offline," move to Stripe Connect once volume justifies it.

**Phase 4 — habit & retention**
- "Hits this month" as a quiet counter, seasonal recaps, club/team leaderboards that are
  opt-in and social rather than personal-guilt loops.
- Travel mode: "I'm in Boston next week, who's around?" — this is a genuinely
  underserved use case and a strong differentiator vs. anything UTR would build.

**Phase 5 — network effects**
- Club/academy accounts that bulk-seed members.
- Court partnerships (book the court from inside the confirmed hit).

### On gamification — the guardrail

The ask was "sticky without feeling like a fitness-tracker guilt app." The rule:
**celebrate what happened, never nag about what didn't.** A recap of 6 hits in October is
delightful. "You haven't hit in 9 days 😟" is an uninstall. Concretely:

- No streaks that *break*. Count totals, not consecutive weeks.
- No red states, no decaying progress bars, no loss aversion.
- Notifications are about *other people* ("Maya countered with Sunday 9am"), never about
  your own inactivity.

---

## Cold start: seed one market, not a country

Launch in a single metro or a single junior-circuit network (Boston area is the obvious
candidate given the Babson connection and the density of NEJTL/college players). Target
~200–400 users inside one ~25 mile radius before opening a second market.

Practical seeding: high school teams, USTA junior sections, college club/varsity rosters,
one or two academies. Invite codes handed out in clusters, not sprinkled.
