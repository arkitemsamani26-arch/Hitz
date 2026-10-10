# Clubhouse, refined

The approved design, brought into the app. This note records what was built, where it
departs from the reference and why, and what was checked.

## The system

- **Tokens** live in `src/theme/tokens.ts`. Two palettes (light and dark, exactly the
  reference values) plus a `fixed` set for the hero, the member card, the wordmark dot and
  the ball, which do not change with appearance. `useTheme()` and `makeStyles()` in
  `src/theme/theme.ts` pick the palette from the device setting; `app.json` is now
  `userInterfaceStyle: "automatic"`.
- **Type**: DM Serif Display (roman and true italic) for headings, names and ratings; DM
  Sans 400/500/600 for everything else. Loaded through `expo-font`; the screenshot script
  prints the faces the browser actually loaded. The wordmark is Arial / sans-serif, 31px,
  weight 800, tracking −1.8, with the 9px dot (`src/ui/Wordmark.tsx`).
- **Drawings**: `src/ui/CourtArt.tsx` holds the only two illustrations: the court outline
  (140×230, rotated 22°) and the shaded ball (39px, two seams, local shadow). Both are
  hidden from assistive tech.
- **Icons**: the Lucide outline set, reduced to the 34 glyphs the app uses, with path data
  copied from `lucide-react-native` 1.54.0 (`src/ui/Icon.tsx`). The full package is not a
  dependency; Metro does not tree-shake and it would have carried 3,700 icons.
- **Motion**: presses scale to 0.975 over 130ms; sheets slide 220ms; the confirmed summary
  fades in once, the first time it is opened. No loops, no sound, no springs. Reduced
  motion turns the press scale off and Reanimated honours it for the entrances.

## Screens

| Screen | File | Notes |
|---|---|---|
| Discover | `app/(tabs)/index.tsx`, parts in `src/ui/DiscoverParts.tsx` | Header, hero, window panel overlapping by 25px, "Your kind of player." with the level range, featured card, compact rows. Waiting invitations show as one soft row linking to My hits. |
| Next window | `src/store/window.tsx`, `src/ui/WindowEditor.tsx` | One concrete date, start and length, kept on the device and seeding every invitation. Separate from the weekly pattern. |
| Featured card | `src/ui/Player.tsx` | Sage stripe, arched monogram, serif name, rating with its source label, the availability line (see below), the green invite strip. |
| Invitation review | `app/request/[id].tsx` | Plan panel with three editable groups; Send invite with sending and failure states; the draft survives a failure. Also the counterproposal. |
| My hits | `app/(tabs)/hits.tsx` | Waiting on you (Accept / Suggest another time / Decline), waiting on them, upcoming, past. Empty state per the reference. |
| Hit detail | `app/hit/[id].tsx` | Eyebrow and serif heading per state; "It's on." with a compact green summary; the plan chips; messages with real send state. |
| Club card | `app/(tabs)/you.tsx`, `src/ui/MemberCard.tsx` | The deep-green card; rows for availability, preference, home court, looking-to-hit, photo, parent; rating source; invites, teams, account. |
| Onboarding, guardian, filters, player, verify, delete | the rest of `app/` | Same surfaces, eyebrow + serif heading, green primary with the arrow. |
| Design preview | `app/preview.tsx`, `src/data/fixtures.ts` | The four reference states with Arki T., Elena R., Kenji O., Monday October 12 2026 and Rinconada Park. Reachable from Demo controls. Labelled on screen; nothing is sent. |

## What the cards say about availability

The data is a coarse weekly pattern, never a promise about one hour, so the strongest
line a card makes is **"Both usually free Monday evenings"** (both masks have that
slot). If only they do: "Elena is usually free Monday evenings". If the chosen window is
outside anything they have said: **"Ask Elena about Monday, 7–8:30 pm"**. With no pattern
at all: "Propose a time to Elena". The rating line is computed: "0.2 UTR apart. A natural
place to start."

Ratings carry their source: `UTR` when verified, `UTR · SELF` when typed in, `ABOUT`
when estimated from the self-assessment ladder. No verification label exists without a
real source.

## Intentional deviations from the reference

- **Text sizes**: the reference's 9–11px labels are 11–12px here (tags, plan labels, meta
  lines, the tab labels), and body copy is 13–15px. Hierarchy is unchanged; everything
  meets 4.5:1 in both palettes.
- **The tag line** on the featured card shows at most two facts so it stays on one line
  at 390px.
- **Window chips**: the reference offers two sample times. The real editor is day (next
  eight days), start (7 am to 8 pm) and length (1, 1½, 2 hours).
- **"Palo Alto · Practice sets"** under the name is `home court · preference` here,
  because the data holds a home court and a distance, not a city.
- **Playing preference** ("Looking for") is a new field. The demo seeds it; the live
  schema has no column yet, so on the live service the editor reports that honestly
  instead of pretending to save.
- **Court booking** is never claimed. Every plan says access and booking were not checked.

## Removed

The sky, sun, time-of-day gradients, blue court surface, the tilted court view, the
match-found poster, the ball burst, the stamp, the sound effects and the bouncing
wordmark. `src/ui/Court.tsx`, `MatchFound.tsx`, `BallBurst.tsx`, `Stamp.tsx`, `Pop.tsx`
and `src/lib/sound.ts` are gone, along with the Bricolage, Instrument Sans and Archivo
fonts and the grain and sound assets.

## Checks

- `npm run typecheck` clean.
- `npm run export:web`, then `npm run a11y` (axe, 12 screens, zero violations) and
  `npm run crawl` (every pressable on every screen pressed).
- `npm run shots <dir>` writes screenshots at 320, 390, 402, 430 and 1024px, light and
  dark, and prints the font faces that loaded.
- Not run here: a device build. The hero, card and tab geometry were checked in the web
  export at the reference width; iOS and Android were not exercised in this session.
