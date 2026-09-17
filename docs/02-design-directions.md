# 2. Design Directions

Three directions, genuinely different — not three shades of the same app. Each is
described as identity + motion + IA consequence, because the visual choice and the
navigation choice aren't separable: "Night Match" implies a swipe-first app, "Baseline"
implies a list-first one.

A shared constraint across all three: **the core loop is three taps.** Open → a player
you want → request sent. Nothing below is allowed to cost a tap.

---

## Direction A — "Clay"

**Editorial, warm, premium. The tennis app with taste.**

- **Palette:** terracotta / burnt clay (`#C4552E`-ish) as the hero, on bone and warm
  off-white. Deep ink navy for text. One acidic accent — a sharp chartreuse — used *only*
  for the primary action and the match-found moment, so it lands every time.
- **Type:** a high-contrast serif or grotesk display for numbers and names (think a
  sports magazine cover), paired with a clean neutral sans for UI. Player names set big.
  The level number is typographically the hero of the card.
- **Texture:** subtle clay grain on surfaces. Photography treated warm and slightly
  desaturated. Cards have real edges and shadow — physical, not flat.
- **Motion:** restrained and confident. Cards rise on press. The match-found moment is a
  slow, satisfying seal — a stamp coming down — rather than confetti.
- **IA:** list-first, scannable, dense-but-airy. Two tabs: **Near You** and **Requests**.

**Reasoning:** this is the direction that makes Hits feel *aspirational* — the app a
serious player is happy to be seen using. It reads adult and durable, and it ages well.
It differentiates hardest from UTR's spreadsheet energy by being the opposite kind of
serious: editorial rather than clinical.

**Risk:** warm-and-tasteful can read as slow. For a 16-year-old who wants a hit on
Saturday, restraint can feel like friction. Also the hardest of the three to execute — a
half-done editorial design just looks beige.

---

## Direction B — "Night Match" ⭐ recommended

**Floodlights on, dark by default, electric.**

- **Palette:** near-black court blue as the ground (`#0B1220`-ish, blue-black not grey),
  with **optic yellow** (`#DFFF4F`) as the single hero accent — the ball, essentially, as
  the app's entire energy budget. Secondary accents in court-line white and a cool
  hard-court cyan. Light mode exists but is the *alternate*, not the default.
- **Type:** a tight, wide-set geometric sans. Numbers are the personality: level deltas
  and distances set in big confident numerals. Uppercase micro-labels for structure.
- **Texture:** court-line geometry used as layout structure — the baseline, service box
  and center mark become dividers, progress states, and empty-state art. Glow rather
  than shadow: the accent color bleeds light onto adjacent surfaces.
- **Motion:** this is where the direction earns itself.
  - **Browsing** is a stack of cards you flick through — swipe right to send a hit
    request, left to pass. Fast, thumb-only, genuinely fun. (Crucially: swipe-right sends
    a *request*, not a "like." No mutual-match gate — that's a dating pattern and it
    halves your liquidity.)
  - **Request sent** — the ball-yellow accent sweeps across the card like a passing shot.
  - **Request accepted** — the money moment. Screen goes dark, the two players' levels
    slam in from opposite sides, meet in the middle, and the court lights come up:
    "SATURDAY 9AM · WESTON COURTS." Haptic thud on impact. This is the screenshot people
    send to their group chat, and it should be built with that in mind.
  - **Loading** — a ball rally bouncing across the baseline, not a spinner.
- **IA:** swipe stack is the home screen. One bottom bar: **Hits** (the stack) ·
  **Requests** (inbound/outbound) · **You**. Filters live in a pull-down sheet, not a
  separate screen.

**Reasoning:** this is the direction most likely to produce the thing you actually asked
for — "an app your friends talk about." It's built around a shareable moment, it's
thumb-native, and it's tonally right for the junior/college core. Dark-by-default is also
honest to the use case: a lot of this app gets opened at night, deciding about tomorrow.
Optic yellow on black is instantly, unmistakably tennis without a single racquet icon.

**Risk:** swipe stacks carry dating-app connotations. Mitigated by (a) no mutual-match
mechanic, (b) tone and copy that are unambiguously about tennis, (c) a list view always
one tap away for people who want to browse properly. The parent-of-a-15-year-old read on
"swipe to find people" needs care — worth testing the framing explicitly.

---

## Direction C — "Scoreboard"

**Swiss, utilitarian, information-dense, extremely fast.**

- **Palette:** hard-court blue and white, with a single hot signal color for actions.
  Big flat blocks of color, no gradients, no glow. High contrast, near-brutalist.
- **Type:** one strong grotesk at many weights. Data-forward. The screen looks like a
  live scoreboard — numbers aligned, tabular, immediately comparable.
- **Motion:** minimal and mechanical. Flip-board digit transitions. Snappy, no easing
  flourishes. Everything under 150ms.
- **IA:** a single dense scrollable list with inline actions. Request-to-hit is one tap
  from the row — no profile detour required.

**Reasoning:** the fastest possible expression of the core loop, and the most legible to
a player comparing ten options at once. It's the direction that most respects a power
user's time, and it's the cheapest and most reliable to build well.

**Risk:** this is the direction that risks becoming what you're running *from*. Done
badly, "Swiss and data-forward" is just UTR with better kerning. It has no emotional
moment and nothing to screenshot.

---

## Recommendation

**Build B ("Night Match") as the base, borrow A's typographic discipline, steal C's
one-tap row action for the list view.**

The reasoning: the differentiated asset here isn't information density (C) or taste (A) —
it's *the feeling of a hit getting locked in*. That moment is the product's emotional
payload and its entire word-of-mouth engine. B is the only direction organized around it.
A and C both treat confirmation as a state change; B treats it as an event.

Guardrails on B so it doesn't tip into gimmick:
1. Every animated moment must be skippable and must never block the next action.
2. The swipe stack has a list-view toggle, persisted. Some people hate stacks.
3. Motion budget: exactly one showpiece animation (match found). Everything else is under
   200ms and functional. Playful loading states are fine; playful *waiting* is not.

## Voice

Confident, short, a little dry. Never exclamation-mark enthusiasm, never corporate.

- Good: "Maya's in. Saturday, 9am, Weston." / "Nobody new in 25 miles. Try 40?"
- Bad: "Congratulations! You've matched with a new hitting partner! 🎾"
- Empty states do the work of a friend, not a brand: "Quiet week. Widen your radius or
  drop your level filter by half a point."

## Next step

Once a direction is picked: a clickable prototype of exactly three screens — the stack,
the request sheet, and the match-found moment. Nothing else. If those three don't feel
good, the rest doesn't matter.
