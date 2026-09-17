# 5. Open Questions & Findings

## UTR data access — researched

**There is an official route, and it's more accessible than expected.**

UTR Sports runs an **Engage API** for approved partners. What it offers:

- OAuth2 — players link their UTR Sports account to a third-party platform and authorize
  data access. Exactly the flow Hits wants: no scraping, the player consents, the rating
  is verified.
- Retrieve current UTR, UTR-P (pickleball), and Color Ball ratings for connected users.
- Extended player profile information.
- Post verified and unverified results back, contributing to ratings progress.

Eligibility: partners must be "a recognized club, academy, software platform, governing
body, or match-play application with a stable user base" offering a legitimate
player-facing service tied to match play, event management, or player development.
Applicants without the prerequisites pay a **$250 non-refundable application fee**.

**Reading of this for Hits:** "software platform / match-play application with a stable
user base" is the category, and "stable user base" is the hurdle — a pre-launch app
probably doesn't clear it yet. Note also that the API is scoped to *connected users*:
it's an enrichment-and-verification channel, not a way to seed a player directory from
UTR's database. That's the right shape for Hits anyway, but it means UTR cannot solve
your cold-start problem. Only invite codes and local seeding can.

**Recommended plan:**

- **v1: self-reported levels with a guided estimator.** No dependency, no fee, no
  approval gate. Mark them clearly as unverified.
- **In parallel, submit the developer application now** — the $250 is trivial against the
  option value, and approval timelines are unknown. Worst case you've spent $250 to learn
  the answer early.
- **v2: UTR linking as a verification upgrade.** A "Verified UTR" badge that unverified
  users visibly lack is a strong pull, and verified ratings make skill-matching
  meaningfully better.
- Design the schema for this from day one: `level_value` + `level_source`
  (`utr_verified` | `utr_self` | `estimated`). Already in the model in `03`.
- **Do not scrape.** Unofficial UTR endpoints exist and are documented in the wild.
  Using them would be a ToS problem, a fragile dependency, and a terrible position to be
  in when you later want a real partnership with the company whose rating your product
  is built on.

Sources: [UTR Sports Engage API](https://www.utrsports.net/pages/engage-api) ·
[Engage API documentation](https://www.utrsports.net/pages/engage-api-documentation) ·
[UTR Sports API integration partners](https://www.utrsports.net/blogs/press/utr-sports-expands-its-ecosystem-with-new-api-integration-partners)

---

## Payments — recommendation: defer

**v1: "arrange payment separately."** Reasons:

1. The Paid Hit tab isn't in the MVP at all, so payments would be infrastructure for a
   feature that doesn't exist yet.
2. Taking payments makes you a marketplace: refunds, disputes, no-shows, chargebacks,
   1099s for hitting partners, and potentially money-transmission questions. That's a
   company function, not a sprint.
3. Minors + payments is the worst possible first payments problem.

**When it's time** (real, repeated paid-hit volume): Stripe Connect Express. Hitting
partners onboard as connected accounts, Hits takes a platform fee, Stripe handles KYC and
tax forms. Hold funds until the session is confirmed by both sides — that no-show
protection is the actual reason a user would prefer in-app payment over Venmo, and it's
the only thing that justifies a fee.

---

## Decisions I need from you

1. **Strict minor/adult separation for beta?** (`04` §2.) My recommendation: yes. It
   costs liquidity but it's the defensible launch posture, and it's easier to relax than
   to retract.
2. **Seed market.** Boston metro is the obvious pick — Babson connection, dense junior
   and college tennis. Confirm, or name another.
3. **Design direction.** A (Clay) / B (Night Match) / C (Scoreboard). My recommendation is
   B with A's typographic discipline. This one is genuinely a taste call and it's yours.
4. **iOS-only beta?** Recommended, unless your seed cohort skews Android.
5. **Submit the UTR developer application now?** ($250, possibly waived.) Recommended yes.
6. **Swipe stack vs. list as the default home.** Tied to #3, but separable — and it's the
   decision most worth putting in front of a few actual juniors *and* a few parents before
   committing.

---

## Things I'd want to validate before writing much code

- Talk to 10 junior players and 5 parents. The specific question for parents: does
  "approve the hit" feel like enough control, or do they want approval before their kid
  can *message* anyone? The answer changes the guardian flow substantially.
- Confirm the seed market has enough density at a given level band. Count real players
  within 25 miles at 4.0–7.0 UTR. If that number is under a few hundred, the radius and
  level-band defaults need to be wider than instinct suggests.
- Sanity-check the estimator: can a player without a UTR self-place accurately enough
  that matches feel right? If self-reported levels are off by ±1.5, the feed is noise and
  UTR linking becomes urgent rather than nice-to-have.
