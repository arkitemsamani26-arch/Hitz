# 16. Launch audit (October 2026)

Written **before** looking at the app, so the list is not shaped by what happened to be
easy to find. Every item gets a verdict, an action, and evidence (a screenshot, a test,
or a command). New things found while walking the app are added at the bottom, marked
*found on the walk*.

Verdicts: **Pass** · **Fixed** (was wrong, now right) · **Open** (needs you, not code).

## A. First run and sign-in
1. A new person understands what Hits is within one screen.
2. Phone sign-in: validation, error text, resend, wrong-code handling.
3. Team / invite code field: valid, used, unknown.
4. Parent sign-in path is findable and different.
5. Every onboarding step: back works, progress is right, nothing clipped at 320px.
6. Location permission is asked only when the benefit is clear; manual court pick works without it.
7. Under-13 is refused; under-18 routes to the parent step; 18+ skips it.
8. Level step: ladder, UTR, NTRP all produce a value and a source.
9. Onboarding survives a reload mid-way (or says so).

## B. Discover
10. Hero, window panel, featured card, rows match the approved design at 390.
11. The next-window editor changes the window and every card's availability line.
12. Filters change results; "no one here" offers a wider search that works.
13. A junior without a parent sees why inviting is locked.
14. Waiting invitations surface on Discover.
15. Pull to refresh; loading and error states.
16. Long names and long court names wrap, not overflow.

## C. Invitations and hits
17. Send an invite: sending, success, failure keeps the draft, no double send.
18. The invite lands in My hits as waiting on them.
19. Incoming: Accept, Suggest another time, Decline all work and say what happened.
20. Counterproposal: shows what they said, refuses an unchanged counter.
21. Junior hit: waiting-on-parent state, parent approves, it becomes confirmed.
22. Confirmed hit: date, time, court, plan, messages, phone sharing.
23. Cancel, reschedule, report, block from the hit.
24. "Did you hit?" after the window passes.
25. Expired and declined invitations read honestly.

## D. Club card and account
26. Every row on Club card opens something that works.
27. Availability, preference, home court, photo edits save (or say why not).
28. Rating source card: all four states read true.
29. Invites and team codes create and share.
30. Sign out and delete account work; delete explains what stays.
31. Privacy, terms, help links exist when configured and are hidden when not.

## E. Parents
32. Parent link page explains the deal before any button.
33. Parent dashboard: approvals, calendar, photo approval, unlink.
34. Approve screen: who, the other side, where and when, messages, block.

## F. Connectors (things the app hands off to)
35. Add a confirmed hit to the phone's calendar.
36. Directions to the court in the maps app.
37. Share an invite code and a confirmed hit.
38. Text the other player when they shared a number.
39. Push notifications registered and routed to the right screen when tapped.
40. Deep links (`hits://hit/...`, parent link) open the right screen.
41. The live Supabase backend supports every field the app now writes.

## G. Quality bar
42. Type check, accessibility audit and button crawler clean.
43. Dark mode readable on every screen.
44. 320px: nothing clipped; 1024px: nothing stretched.
45. No console errors on any screen.
46. Copy: no em-dashes in UI text, no jargon, no "Lorem", no placeholder names shown as real.
47. Nothing claims a booking, a verification or an activity that did not happen.
48. Reduced motion respected.

## H. Store readiness
49. `app.json`: name, icon, splash, colours match the new design; permissions minimal with honest purpose strings.
50. `eas.json` profiles valid.
51. Privacy and data-safety answers match what the code collects.
52. Age assurance plan (Declared Age Range / Play signals) recorded.
53. Store listing copy and screenshots prepared.
54. What is left for you, in order.

---

## Findings

### Verdicts

| # | Item | Verdict | What happened |
|---|---|---|---|
| 1 | Understand Hits in one screen | Pass | Sign-in opens with the green welcome card: "Find your kind of tennis." |
| 2 | Phone sign-in | **Fixed** | The live backend was sent the number exactly as typed. Supabase needs `+16505550137`, so "(650) 555-0137" would have failed for every real user. Numbers are now normalised (`src/lib/phone.ts`) and formatted as you type. Added "Send a new code" after 30 seconds and "Wrong number?". |
| 3 | Team / invite code | Pass | Valid, used and unknown codes each say what they mean. |
| 4 | Parent sign-in path | Pass | "Signing in for your kid?" swaps the copy. |
| 5 | Onboarding steps | Pass | Every step walked at 390; back and progress correct. |
| 6 | Location permission | **Fixed** | "Use location" sorted nothing on the live backend: court positions only existed for demo IDs, so a random list was labelled "Closest to you". Positions now register by name for live courts, and the label is withheld when there is nothing to sort by. The app now asks for approximate location only (Android coarse, iOS reduced accuracy by default). |
| 7 | Age routing | Pass | Under 13 refused, 16 routed to the parent step. |
| 8 | Level step | Pass | Ladder gives "ABOUT", typed UTR gives "UTR · SELF". |
| 9 | Reload mid-onboarding | Pass | The last step detects a lost draft and restarts at the court step with a message. |
| 10 | Discover matches the design | Pass | Screenshot at 390. |
| 11 | Window editor | Pass | Changing the day moves the panel and every card's availability line. |
| 12 | Filters and wider search | **Fixed** | With four filters on, "Widen the search" only stepped the radius by five miles and the list stayed empty. One tap now relaxes every narrowing filter, steps the radius out, and says exactly what it changed. The empty state names your active filters. |
| 13 | Junior lock | Pass | The invite strip reads "Unlocks when your parent says yes". |
| 14 | Waiting invitations on Discover | **Fixed** | Discover featured Kenji with "Invite to hit" while Kenji was already waiting on your reply. Anyone you have an open invitation or a booked hit with is now left out of the featured slot, and their row says "Invited you", "Invite sent" or "Hit on the calendar" and opens the hit. |
| 15 | Refresh, loading, error | Pass (code read) | Loading seen on the walk; the error card with Try again was read in code, not forced. |
| 16 | Long names | Pass (code read) | Featured and profile names wrap; compact rows truncate to one line by design. Not tested with a real long name. |
| 17 | Send an invite | Pass | Sending state, toast, draft kept on failure. New: the suggested court is halfway between your home courts, and the note says why. |
| 18 | Lands in My hits | Pass | Under "Waiting on them". |
| 19 | Accept / Suggest / Decline | **Fixed** | Worked, but the card did not show what they wrote or how long you had. Their note and "expires in 3 days" are now on the card. |
| 20 | Counterproposal | Pass | Shows their proposal and refuses an unchanged counter. |
| 21 | Junior approval | Pass | Waiting-on-parent state, then confirmed. Server tests cover it. |
| 22 | Confirmed hit | **Fixed** | Added Add to calendar, Directions and a working Share; reschedule moved to the menu. |
| 23 | Cancel, reschedule, report, block | **Fixed** | A client could move a confirmed hit to a new time and leave it "confirmed" without the other player agreeing. Any change of time or court is now a counterproposal on the server (migration `20261011000100`, 13 new tests). A past hit cannot be moved or cancelled. |
| 24 | "Did you hit?" | **Fixed** | A hit from last week still said "It's on." with Reschedule and "Running 5 late". Past hits now ask "How did it go?" first, and offer "Hit with Sofia again". |
| 25 | Declined and expired | Pass | Real reason shown. |
| 26 | Club card rows | Pass | Each opens its editor or sheet. |
| 27 | Profile edits | **Fixed** | "Looking for" had no column on the live backend and refused to save. Added `profiles.prefers`, returned by discover, applied live. |
| 28 | Rating source states | Pass | Four states, all true. |
| 29 | Invites and teams | **Fixed** | On the web, sharing a code did nothing at all. Codes now copy to the clipboard where there is no share sheet, and say so. |
| 30 | Sign out and delete | **Fixed** | Parents had neither. They now have Sign out, Delete my account (with parent-specific wording), help and policies. The delete screen pointed at a "Usually free" switch that no longer exists. |
| 31 | Legal links | Pass | Hidden until `EXPO_PUBLIC_LEGAL_URL` is set. |
| 32 | Parent link page | Pass | |
| 33 | Parent dashboard | **Fixed** | See 30. |
| 34 | Approve screen | Pass | |
| 35 | Calendar | **Added** | System new-event screen on iOS and Android (nothing written silently, no read access), `.ics` download on the web. Verified: the file carries the right time, title and court. |
| 36 | Directions | **Added** | Apple Maps on iOS, the default maps app on Android, Google Maps on the web, using the court's city-level address. |
| 37 | Share | **Fixed** | See 22 and 29. Shares first names, day, time and court only. |
| 38 | Text the other player | **Fixed** | Sharing your number saved but the screen never refreshed, so the button looked dead. It now updates and confirms. |
| 39 | Push | **Fixed** | Three problems. Tapping a notification opened nothing; it now opens the hit, or the approval screen for a parent. Push text used the server's UTC clock ("Tue 01am" for a 6pm hit); it now uses the court's time zone. Counters, passes and cancellations sent no push at all; they now do. |
| 40 | Deep links | Pass (web only) | `/hit/<id>` and `/guardian/link?link=` open directly in the web build. The `hits://` scheme needs a device build to test. |
| 41 | Live backend supports the app | **Fixed** | See 27; migration applied to the live project and verified. |
| 42 | Checks | Pass | Type check, 221 database tests, axe on 12 screens, crawler on every button. |
| 43 | Dark mode | Pass | Discover, Club card and the confirmed hit re-shot in dark. |
| 44 | 320 and 1024 | **Fixed** | See "Found on the walk": Accept clipped at 320; fixed and re-shot. |
| 45 | Console errors | Pass | None on either journey. |
| 46 | Copy | Pass | No em-dashes left in interface text. |
| 47 | No false claims | Pass | Booking never claimed; "Usually replies" and "N hits played" only from server-counted data. |
| 48 | Reduced motion | Pass (code read) | The press scale checks the setting and Reanimated honours it for entrances. Not run with the setting on. |
| 49 | `app.json` | **Fixed** | The app icon was Expo's template placeholder (an automatic rejection). New icon set drawn from the wordmark (`scripts/icons.mjs`). Removed the unused audio plugin; notification colour, calendar permission text and description added. |
| 50 | `eas.json` | **Fixed** | The development profile needed `expo-dev-client`; installed. |
| 51 | Privacy answers | **Fixed** | Precise location is now "not collected"; calendar access described. |
| 52 | Age assurance | Open | Needs Apple's entitlement; see docs/11 §4. |
| 53 | Listing and screenshots | **Added** | `docs/store/`. |
| 54 | Your list | Open | Below. |

### Found on the walk

- Demo notifications claimed "Saturday morning" whatever the time was. They now state the real time and carry the hit, so tapping works in the demo too.
- Availability read "weekend mornings and afternoons and evenings". Now "weekend mornings, afternoons and evenings".
- Form labels were not attached to their inputs, so a screen reader read "edit text" for the parent's phone and email. Every labelled field now announces its label.
- The live court list carried approximate placeholder pins (seed.sql says so). Directions now use city-level addresses instead of pins.
- At 320px the Accept button was squeezed to "Accep". Accept now has its own full-width row, and headings step down on narrow phones (the reference's own 365px rule), so "to look forward to." stays on two lines.
- The "development" EAS build profile needed `expo-dev-client`, which was not installed; that build would have failed. Installed.
- The crawler flagged both share buttons on a confirmed hit as dead. Probed by hand, both work. Two crawler weaknesses explained it: it compared only how long the page text was, so "Share my number" turning into "Hide my number" looked like nothing, and it looked once after 0.9 seconds while the share toast took about 1.9 in its session. It now compares the words and waits up to 2.5 seconds. `CRAWL_ONLY="<screen>"` runs one screen.
- "Share my number" and the card's "Share" had the same label, which a screen reader cannot tell apart. Renamed.

### What is left, and it is yours

1. **Developer accounts** (Apple $99/yr, Google $25). Apple needs an adult's name.
2. **Host `legal/`** and set `EXPO_PUBLIC_LEGAL_URL`. Have the privacy policy read by a lawyer.
3. **Vault secret** `service_role_key` in the Supabase dashboard, so push actually sends.
4. **Test OTP numbers** in Supabase Auth for App Review (see `docs/store/listing.md`).
5. **Verify every court pin and address** against the real facility before launch.
6. **Age assurance**: request Apple's Declared Age Range entitlement.
7. **`eas init`, then a preview build** on your own phone. Calendar and push were tested on the web build only; they need a real device once.
