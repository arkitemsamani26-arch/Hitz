# 4. Safety by Design

Hits connects strangers — some of them minors — and then arranges for them to meet in
person. That is the product. It cannot be a feature added in Phase 3.

This document is a proposal, not legal advice. Before public launch you want an actual
lawyer on COPPA, state minor-consent laws, and your ToS. But the architecture below is
what makes that conversation short and cheap instead of a rebuild.

## Principle

**Default to the most restrictive thing that still lets the loop close.** Every relaxation
should be an explicit, reviewed decision — never an accident of implementation.

---

## 1. Age tiers

| Tier | Rule |
| --- | --- |
| **Under 13** | Not permitted. COPPA's verifiable-parental-consent regime is a serious compliance burden and a poor fit for a pre-launch product. Hard floor at 13. |
| **13–17 (minor)** | Full product access **only** after a guardian link is verified. Until then: browse-only, no outbound requests, not discoverable. |
| **18+ (adult)** | Full access. |

DOB is collected at signup and is not user-editable afterward without support review.
`is_minor` is a generated column from DOB — never a client-supplied field, never
trusted from the app.

## 2. The separation rule

**In v1, minors and adults do not appear to each other in discovery and cannot initiate
contact across the boundary.**

This is the strongest simple rule available, and simple rules are the ones that survive
contact with a growing codebase. A 16-year-old's feed contains 13–17 year olds. An adult's
feed contains adults. Enforced as an RLS predicate on the discovery view, so no client
bug can defeat it.

The cost is real: it splits your liquidity pool in a product where liquidity is the
whole game, and it blocks legitimate cases (a junior hitting with a 30-year-old 7.0 at
the same club, a college player home for the summer hitting with a high schooler). Those
are *good* tennis outcomes and the rule kills them.

The v2 relaxation, once there's a moderation function to support it: allow cross-boundary
connection only when it is **guardian-initiated or guardian-approved per request**, and
only with adults who are verified (UTR-linked + phone + ideally club-affiliated). Not an
open setting the teenager can flip.

> **Decision needed from you:** is the strict split acceptable for beta? It's the safer
> launch, and if the seed market is a junior circuit the minor-to-minor pool may be dense
> enough on its own. My recommendation is yes, ship strict, relax deliberately.

## 3. Guardian accounts

For 13–17:

- Signup collects a guardian email **and** phone. Guardian receives a link, creates their
  own account, and confirms the relationship. No link, no participation.
- Guardian has a dashboard: their kid's profile, all hit requests, all message threads.
  Full visibility, not summaries.
- **Guardian approval is required to confirm a hit** — the request can be sent and
  accepted by the kids, but the hit isn't confirmed (and the court/time isn't shown as
  locked) until a guardian taps approve. This is the key design move: it keeps the fun,
  fast part with the kids and puts the adult in exactly one place — the moment before a
  real-world meeting.
- Guardians can revoke, pause the account, or block a user on their kid's behalf.
- One guardian may link multiple children.

This directly solves the problem in the brief: parents stop being the *coordination*
layer and become the *approval* layer. The texting stops; the oversight remains.

## 4. Location

- **Exact coordinates are never exposed to any client.** They live in a private table
  with no client select grant.
- Discovery exposes a **snapped centroid** — a point rounded to roughly a 1–2 km grid —
  plus a bucketed distance ("~4 mi", not "1.8 mi").
- Users set a **home court** from a curated directory, not a home address. The app never
  asks where you live, which removes a whole class of risk by simply not holding the data.
- Precise court location is revealed only for a **confirmed** hit, and it's a public
  court either way.

## 5. Meeting locations

- Hit requests must specify a court from the curated directory. Free-text locations are
  not accepted in v1.
- The directory contains public courts, clubs, and academies — no residences. Private
  courts are a v2 problem with its own review.
- Minors' hits are restricted to courts flagged `public` or `club`.

## 6. Verification tiers

Shown on profiles as escalating badges:

1. **Phone verified** — required for everyone, day one.
2. **UTR-linked** — via the Engage API OAuth flow (see `05`). Strongest signal available:
   it means a real, rated player with a match history.
3. **Club/team affiliated** — vouched by a club or coach account. Phase 3.

Unverified self-reported levels are visibly marked as such. Not a punishment — just
honest labeling, and it creates pull toward UTR linking.

## 7. Report / block / moderate — day one

- **Block** from a profile, a card, or a thread. Blocking is bidirectional and total:
  blocked users vanish from each other's discovery, and existing threads close.
- **Report** with structured reasons (fake profile, inappropriate messages, age
  misrepresentation, no-show, safety concern, other) plus free text. Reports on a minor's
  thread are flagged priority.
- **Auto-protective actions**: N independent reports inside a window auto-hides the
  profile from discovery pending review. Erring toward false positives is correct here.
- **A human reviews the queue.** A report button with nobody behind it is worse than no
  report button, because it manufactures false confidence. Before beta opens, name the
  person who reads the queue and the SLA. At beta scale that's you, daily.
- Emergency guidance: a visible "something happened" path in the confirmed-hit view with
  clear instructions, including that emergencies go to 911 and not to an app.

## 8. Data minimization

- Display name is first name + last initial until a hit is confirmed.
- Phone numbers are never shown to other users, at any stage. In-app messaging only.
- Guardian contact info is visible to no one but the guardian and support.
- Minors' data is excluded from any future third-party analytics or ad tooling by
  default. Set this up now; it's painful later.
- Retention: message threads and location history purge on a defined schedule (suggest
  12 months); accounts deletable with real deletion, not soft-flagging.

## 9. Paid Hits and minors

The Paid Hit tab is **18+ on both sides** at launch. A minor paying an adult to hit —
money, a private arrangement, a power imbalance — is a categorically different safety
product. When it does open to juniors, the design should be guardian-books-and-pays,
coach credentials verified (SafeSport / background check where applicable), never
kid-to-stranger.

---

## Pre-beta checklist

- [ ] RLS policies written and tested with an adversarial test suite (can an adult's
      session reach a minor's row, by *any* query the client can construct?)
- [ ] DOB gate + guardian flow end-to-end, including revocation
- [ ] Exact coordinates verified unreachable from every client role
- [ ] Block/report shipped, moderation queue live, reviewer named
- [ ] ToS + privacy policy reviewed by counsel, with a minors section
- [ ] Incident plan: what happens, and who does it, in the first hour after a real report
