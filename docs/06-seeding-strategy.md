# 6. Resolving the Seeding Contradiction

**The problem:** strict minor/adult separation is ruled in. The founder's most recruitable
network is a college team — adults. Under strict separation those recruits are invisible
to juniors, who are the wedge. Seeding the easy network builds a pool the target users
can't see.

**Recommendation: Option 1 — seed juniors deliberately and separately, and accept the
slower start.** With one reframe that makes it much less costly than it looks, and one
piece of infrastructure that makes the cost *visible* instead of hidden.

---

## Why not option 2 (per-request guardian approval in v1)

This is the option that would make the founder's own network immediately usable, which is
exactly why it deserves the hardest look.

Stated plainly: **per-request guardian approval is a weak control wearing a strong
control's clothes.** It asks a parent to evaluate whether a specific adult stranger is
safe to meet, based on a profile card, a rating, and a photo. Parents have no basis to
make that judgment — the app is handing them a decision it can't make itself and calling
it oversight. It will feel like safety to everyone involved right up until it isn't, and
after an incident the sentence "the app let a parent approve it" is not a defense.

There's an architectural cost too. Strict separation is valuable precisely because it's
*unconditional*: one predicate, one invariant, testable in a single assertion — no adult
session can reach a minor row by any query. The moment cross-band contact is permitted
under a condition, the invariant becomes conditional, and every future feature has to
re-derive it correctly. Conditional invariants are where the bug will be.

Option 2 stays the right *eventual* relaxation, as originally proposed. It just needs to
arrive with a moderation function, adult verification beyond a phone number, and real
usage data behind it — not in the release that has none of those.

## Why not option 3 (club/team-scoped visibility)

Better safety logic than option 2 on paper: an institution is present, an adult is
accountable, and there's a real-world relationship predating the app.

It fails on a practical detail. In v1 there is no club verification infrastructure — no
verified club accounts, no membership rosters, nobody at the club vouching. So "same
club" would be a **self-declared text field**. A self-declared affiliation that unlocks
cross-band discovery is strictly worse than option 2: it's spoofable by typing, and an
adult seeking access to minors would find it in about four seconds. This is the single
most dangerous thing that could go into v1.

Option 3 is genuinely the best long-term answer — it's the relaxation with a real
accountability story — but it is downstream of club verification, which is Phase 3.

So: `clubs` and `club_memberships` exist in the schema now, carrying a `verified_at`
column that nothing sets yet, and **no visibility power whatsoever**. The shape is
reserved; the privilege is not granted.

---

## The reframe: the college network is a recruiting channel, not a pool

The contradiction assumes the college team is valuable as *users*. Its far higher value
is as *distribution*.

College players are the most credible recruiters of junior players that exist. They
coach at academies and summer camps. They string for juniors, feed baskets, hit with the
top kids at the same clubs. Juniors look up to them in a way no marketing does. A
Babson player handing invite codes to the four 16-year-olds they hit with at the club is
worth more junior signups than that player's own account will ever be.

So the college network gets used immediately — as the instrument, not the inventory.

## And seeding both costs nothing

Worth being precise, because it's easy to over-correct: under strict separation, signing
up college and adult players doesn't *hurt* the junior pool. It just doesn't help it.
Boston's adult competitive scene is genuinely dense and is a legitimate second cohort
that can run in the same market, in parallel, never interacting.

The failure mode isn't seeding adults. It's **counting adult signups as progress toward
junior density** and opening discovery to juniors on the strength of a number that was
mostly adults. That's how a junior opens the app to eleven people and never returns.

## The infrastructure that makes this honest

Density must be measured and gated **per cohort**, not per market. Hence
`market_cohorts`: one row per `(market, age_band)`, each with its own configurable
`min_active_players` threshold and its own `discovery_open` flag.

- The junior cohort in Boston opens when the *junior* count clears its threshold.
- The adult cohort opens on its own count, whenever that happens.
- `app.market_cohort_density` reports live counts against thresholds, so the question
  "is the pool actually thick enough?" has a number rather than a feeling.
- Until a cohort opens, its members get an honest waiting state ("142 of 200 juniors in
  Boston — we'll open discovery when it's worth opening") rather than a thin feed. A thin
  feed spends a first impression you only get once; a countdown spends nothing and can
  even build anticipation.

## Concretely, for Boston

**Primary (the wedge):** juniors, 13–17. Recruit through academies, high school teams
(Wellesley, Needham, Weston, Dover-Sherborn, Newton), USTA New England junior circuits,
and the indoor clubs that run winter junior programming. Invite codes handed out in
clusters — a whole team at a time, never sprinkled — because two juniors from the same
team who can actually hit with each other is worth more than twenty strangers scattered
across the metro.

**Secondary (parallel, self-funding):** college and adult players, seeded through the
Babson team and its opponents. Their cohort opens on its own schedule.

**The college network's first job is neither.** It's handing codes to the juniors they
already hit with.

**Honest expectation:** this is slower than option 2 by something like a season. The
junior cohort in a dense metro through one winter indoor season is a realistic target for
the 200–400 threshold. That is the cost of the ruling, and it's worth paying.
