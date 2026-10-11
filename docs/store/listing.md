# Store listing

Copy for App Store Connect and the Play Console, written against what the app does today.
Character limits are the stores' own. Screenshots are in this folder (1290 × 2796, the
6.7-inch size both stores accept) and use the demo's sample players, so the listing
should not imply they are real members.

## Name and subtitle

| Field | Text | Limit |
|---|---|---|
| App name | Hits: Tennis Partners | 30 |
| Subtitle (iOS) | Hit with players at your level | 30 |
| Short description (Play) | Find tennis partners at your level, on courts near you. Invite, agree, play. | 80 |

## Promotional text (iOS, 170)

Find someone at your level who is free when you are, pick a court halfway between you, and send one invitation. It is on when you both agree.

## Description

Hits finds you tennis partners at your level, on courts near you, at times you can actually play.

**Your kind of player.** Set your rating (UTR, NTRP, or just describe how you play) and the courts you use. Hits shows players near your level and nearby, and tells you plainly when your weeks line up: "Both usually free Monday evenings", or "Ask Elena about Monday" when it does not know.

**One invitation, not a group chat.** Pick a day, a time and a court. Hits suggests the court halfway between your two home courts so nobody drives the whole way. Send it. The other player can accept, suggest another time, or pass with a real reason, so you never wait on silence.

**It's on.** Once you both agree, add it to your calendar, get directions to the court, and sort out who brings balls. Share your number for that one hit if you would rather text, and take it back any time.

**Built for juniors and their parents.** Players under 18 only ever see other players under 18. A parent links once, by text, and approves each meetup before it is confirmed. They see every invitation and message in full. No adult can find or contact a junior on Hits; the database enforces it, not a setting.

**Private by default.** Your phone number is your login and is never shown. Hits uses approximate location only, rounds it to about two kilometres, and never stores the precise point. There is no advertising and no third-party analytics.

Hits does not book courts or check court availability. Check each court's own rules before you go.

## Keywords (iOS, 100)

tennis,hitting partner,tennis partner,practice,junior tennis,courts,rally,match,club,sports

UTR and NTRP are left out on purpose: they are other organisations' marks, and Apple rejects
keywords that use them (guideline 2.3.7). Naming them in the description, as a fact about
what ratings you can enter, is fine.

## Category and rating

- **Category:** Sports. Secondary: Health & Fitness.
- **Age rating:** answer the questionnaire honestly. The app has user-to-user messaging between matched players, and meetups in person, which puts it at **13+** on the App Store's current scale and **Teen** on Google Play. Say yes to "user-generated content" and describe the moderation: report and block on every profile and hit, a person reads every report, parents approve every junior meetup.
- **Made for Kids:** no. Hits is 13 and up.

## Review notes (for the App Review team)

The app opens in demo mode if no backend is configured. For review, provide a test account on the live backend:

- Adult test player: a phone number with a fixed test code, set in Supabase Auth → Phone → Test OTP.
- A second adult test player, so the reviewer can send and accept an invitation.
- Explain: location is optional (pick a home court instead); the calendar is written only through the system's own new-event screen; account deletion is in Club card → Delete my account.

## What the screenshots show

1. Discover: the hero, your next window, a suggested player.
2. Invitation: date and time, the suggested court with its honest booking note, the kind of hit.
3. My hits: an invitation waiting on you, with Accept, Suggest another time, Decline.
4. It's on: the confirmed hit with Add to calendar, Directions, Share, and the plan.
5. Club card: your player card and the settings beneath it.
6. A player's profile: rating with its source, track record, when they usually play.
