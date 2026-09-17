# 7. Build Notes — Steps 2 through 7

What was built, what I'd change having built it, every decision that wasn't specified,
and where the safety model forced an interface compromise.

## What's here

**Design system** (`src/theme`, `src/ui`): Night Match tokens with measured contrast
(ink 17.8:1, ink2 9.1:1, ball 16.4:1 on the court ground; ink3 at 4.6:1 is confined to
non-essential labels). Archivo in four weights only. Court-line primitives (`Baseline`,
`ServiceBox`, `CourtLines`) used as layout structure. Springs (`snap`, `land`, `press`,
`fling`) rather than easing curves; every interactive element responds inside 150ms.
Haptics on exactly three moments: sent, accepted, confirmed. Reduced motion respected
everywhere motion exists.

**Data layer** (`src/data`): one `HitsApi` interface, two implementations. `demo` is an
in-memory Boston seed where other players reply on a delay so the loop closes; `supabase`
is written against the schema in `supabase/migrations`. The screens don't know which one
they're talking to.

**Screens**: onboarding (phone → code → name → birthday → level → peek → court →
availability → guardian → ready), discovery (swipe stack and list, filters, cohort
countdown), player detail with block/report, request compose (also used for counters),
requests tab with one-tap accept and reasoned pass, hit detail that changes shape with
state (your move / waiting on them / waiting on a parent / confirmed / declined /
played), the guardian's three screens (what-you-control page, dashboard, approve), the
You tab, and the match-found showpiece.

**Verified**: typecheck clean; the demo build walked end to end in Chromium at phone
size — 28 screens, zero console errors — including the full junior path through both
parents' approval to the confirmed moment.

## Decisions I made that you didn't specify

1. **Swipe right sends immediately, with smart defaults and a 4.5s undo.** You said a
   swipe sends a real request; a request needs a court and a time. Rather than open a
   sheet after every swipe (which makes the swipe pointless), the swipe sends with their
   home court and the first slot where your availability overlaps, and shows an undo
   toast. Full control is one tap away on the profile. Recipients can counter in one tap,
   so a guessed time is cheap. Flagging because it's the most opinionated call in the app.
2. **Home court is your location.** The app never asks for an address, and on web it
   never asks for device location either: the profile's home court is where the radius
   is drawn from. It's honest (players do think of themselves as "at Longfellow"), it
   removes a permission prompt from onboarding, and it removes a class of risk by not
   holding the data. `set_my_location` exists in the schema for when a device location
   is worth having (travel mode, later).
3. **Level self-assessment is a ladder of six sentences**, mapped to UTR bands, with "I
   know my UTR" as the escape hatch to a stepper. The number is shown big and live as
   they pick. Estimated levels are stored as `estimated`, entered UTRs as `utr_self`.
4. **A "peek" step after level, before court and availability.** "Let them see something
   good before asking for much" — after two answers the app shows the count of players
   around their level and three anonymised cards. In the Supabase build, RLS correctly
   returns nothing before a profile exists, so the peek shows the cohort count only.
5. **Passing has four reasons and they are sent to the requester.** "Not this week",
   "Too far for me", "Level's a bit off", "Can't make it work". The requester sees the
   reason, and the copy tells them it was a real reply. This is the anti-ghosting
   mechanism with design behind it, not just a button.
6. **The profile is created at the end of the availability step**, before the guardian
   step, so the guardian invite has a profile to attach to. A minor who quits during the
   guardian step has an account that can browse and nothing else.
7. **Minors default to list view; the preference persists.** As ruled. Stack is one tap
   away and the toggle label names the view you'd switch *to*.
8. **The "It's on" card replays the moment.** The showpiece plays once automatically,
   the first time a hit is seen confirmed; tapping the confirmed card replays it. Share
   uses the OS share sheet with a one-line text.
9. **No sound.** Not tested, not shipped. Adding it means an audio module and an asset;
   I'd rather you hear the haptic thud on a device first and decide whether a ball-strike
   on top of it is more or less. My guess is less.
10. **Guardian's decline is a decline.** If a parent passes, the hit goes to `declined`
    with the reason "A parent passed on this one". The other kid sees that, not the
    parent's name.
11. **Reports say "goes to a person, same day."** That's a promise the interface makes
    on your behalf; the moderation queue is `service_role` only and has no UI yet, so the
    person is you, with SQL, until it does.
12. **Ghost stats are visible on your own profile too**, with the line "Everyone sees
    these. Reply — even 'no' — and they stay good." Knowing you're measured is half of
    what makes the measure work.
13. **Onboarding progress is a line that gets longer**, no step counter. It's the
    baseline filling with ball yellow.

## Where the safety model forced an awkward compromise

- **The gap between "accepted" and "confirmed".** For two juniors, the happy path has
  three parties who each have to act, and two of them are parents on their own schedule.
  That's a real dead-air problem: the kids are done and excited, and nothing happens for
  hours. The "Almost on." screen is designed as anticipation rather than a block, and
  chat stays open through it, but it is still the one place the product asks a
  fourteen-year-old to wait for an adult. A nudge-a-parent button was considered and cut:
  it turns the parent into the person being pestered, which is the relationship the
  product is supposed to end.
- **Guardian link is required before a minor can send anything.** So a junior who
  finishes onboarding and sees a great player can't act on it until a parent has clicked
  an email. The banner ("Browse away. Reaching out unlocks once your parent says yes.")
  and the disabled row buttons make the state honest, but there's no getting around it:
  the first session for most juniors ends in a wait. Getting the parent to verify fast
  (an SMS as well as an email; a "your kid just joined Hits" message that leads with the
  one-sentence thesis) is the single highest-leverage thing in the funnel.
- **Peek before profile can't show real players in the Supabase build.** RLS is doing
  its job — no profile, no band, no rows — so the count is the whole peek. The demo
  shows cards because it can. Worth a dedicated RPC later that returns only aggregate
  counts by band and level bucket, which would be safe to expose.
- **The parent can't be shown the other kid's parent.** The approve screen names the
  other player and their verified signals, but the other guardian is invisible, because
  guardian identity is private to their own child. Some parents will want "who is the
  adult on the other side?" and the answer is "there is one, and they approved too" —
  which is what the screen says, but it's a thinner reassurance than a name.
- **Blocking from the guardian side is described but not built.** The approve screen
  says a parent can block on their kid's behalf; the schema supports it (the guardian
  can read the child's profile) but there's no guardian-side block action in the app
  yet. Copy is ahead of the build there; fix before beta.

## What I'd change having built it

- **The swipe stack is the weaker of the two views on this content.** The list is
  denser, faster, and the one-tap row action is the best thing in the app. The stack
  earns its place for the browsing-at-night use case and for the shareable "HIT?" swipe
  feel, but if I had to keep one, it's the list. I'd consider making the list the default
  for everyone and the stack the toggle, not just for guardian-linked accounts.
- **Requests and Hits should probably be one screen.** The core loop is discover →
  request → confirm, and splitting it across two tabs means the "your move" state lives
  behind a badge. A single feed with "Your move" pinned at the top of discovery would
  keep the loop on one screen. Didn't do it because you specified the IA and it's an
  easy change later.
- **Counter-proposals reuse the compose screen**, which works but doesn't show what
  they originally proposed side by side. A "they said Saturday 9am, you're saying…"
  header would help.
- **The demo layer grew logic that mirrors the database triggers** (approval seeding,
  auto-confirm, reconciliation after reload). That's inevitable in a mock but it means
  two places to keep in sync. Once a Supabase project exists, I'd delete most of it and
  run the demo against a seeded local Supabase instead.
- **`useAsync` + `tick` is a thin substitute for a query cache.** It works at this size;
  the first sign of it creaking is duplicated fetches from the tab bar badge and the
  Requests screen. React Query or a small store would replace it in an afternoon.
- **The waiting-on-parent court glow reads slightly heavy** on some screens. I thinned
  the lines once; the glow-stroke variant may want a second pass on a real device.

## Not yet done from the plan

- Invite codes: schema exists, app flow doesn't (the You tab says "Soon").
- Moderation queue surface for the reviewer.
- Guardian-side block.
- Push notifications: the hooks are where they'd go (state transitions in the demo
  mirror where the server would send), nothing is wired.
- The Supabase implementation has not been run against a live project. Specific things
  to verify first: the `app` schema is exposed in the API settings; `discover()`'s
  return shape matches the mapper; realtime events fire for the three tables; and that
  `stamp_phone_verified` runs after the first profile insert.
