# Store listing

Copy for App Store Connect and the Play Console, written against what the app does today.
Character limits are the stores' own. Screenshots are in this folder (1290 × 2796, the
6.7-inch size both stores accept; eight of them, under the ten both stores allow) and use
the demo's sample players, so the listing should not imply they are real members.

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

**One invitation, not a group chat.** Pick a day, a time and a court. Hits suggests the court halfway between your two home courts so nobody drives the whole way. Whoever asks brings the balls. The other player can accept, suggest another time, or pass with a real reason, so you never wait on silence.

**Talk it through.** Every hit has its own conversation, with one-tap replies like "On my way" and "Running 5 minutes late". Share your number for that one hit if you would rather text, and take it back any time.

**Courts near you.** See every public park and club court nearby, how far each is from yours, and who calls it home. Invite someone to meet you there in two taps.

**It's on.** Once you both agree, add it to your calendar, get directions to the court, and sort out the plan: balls, sets or drills, where to meet.

**Built for juniors and their parents.** Players under 18 only ever see other players under 18, and they see each other's ages, so two 13-year-olds find each other first. A parent links once, by text, and approves each meetup before it is confirmed. One family view covers every child: what needs an OK, what's on the calendar, and how close in age their partners must be. Parents see every invitation and message in full. No adult can find or message a junior on Hits; the database enforces it, not a setting. The one exception is a coach the parent approves by name, and even they can only suggest partners. For younger kids, a parent sets up the account on their own phone and runs it: they find the hit with their child, send it, and see every message. From 13, they can hand it over with everything in it.

**Coaches pair their players.** Run an academy or a team? Turn on coach tools, share your code, and pair your players to hit with each other between lessons. They get your suggestion with your note, one of them sends the invite, and you see how it went.

**Hits Plus, if you want more.** Everything above is free. Plus ($4.99 a month) adds auto-match, where Hits sends the invitations for you until someone says yes; unlimited open invitations; every filter; the whole free-this-week list; saved searches with alerts; your stats; private notes on partners; and a fuller card. A parent's Plus covers their children.

**Private by default.** Your phone number is your login and is never shown. Hits uses approximate location only, rounds it to about two kilometres, and never stores the precise point. There is no advertising and no third-party analytics.

Hits does not book courts or check court availability. Check each court's own rules before you go.

## Keywords (iOS, 100)

tennis,hitting partner,tennis partner,practice,junior tennis,courts,rally,match,club,sports

UTR and NTRP are left out on purpose: they are other organisations' marks, and Apple rejects
keywords that use them (guideline 2.3.7). Naming them in the description, as a fact about
what ratings you can enter, is fine.

## Category and rating

- **Category:** Sports. Secondary: Health & Fitness.
- **Age rating:** answer the questionnaire honestly. The app has user-to-user messaging between matched players, and meetups in person, which puts it at **13+** on the App Store's current scale and **Teen** on Google Play. Children under 13 are on Hits only through an account a parent sets up and runs from the parent's own sign-in; mention this in the review notes, and do not opt into the Kids category (the app is used by the parent, not the child). Say yes to "user-generated content" and describe the moderation: report and block on every profile and hit, a person reads every report, parents approve every junior meetup.
- **Made for Kids:** no. Hits is 13 and up.
- **In-app purchases:** one auto-renewing subscription, `hits_plus_monthly`, $4.99 a month. The paywall shows the price, the term, Restore Purchases and links to the Terms and Privacy Policy (guideline 3.1.2). Players under 18 are never shown a purchase; a parent buys it on their own account.

## Review notes (for the App Review team)

The app opens in demo mode if no backend is configured. For review, provide a test account on the live backend:

- Adult test player: a phone number with a fixed test code, set in Supabase Auth → Phone → Test OTP.
- A second adult test player, so the reviewer can send and accept an invitation.
- Explain: location is optional (pick a home court instead); the calendar is written only through the system's own new-event screen; account deletion is in Club card → Delete my account.

## What the screenshots show

1. Discover: the hero, your next window, shortcuts, your next hit, a suggested player.
2. A player card: photo, rating with its source, hits played, reply rate, when they play.
3. A conversation: the hit it belongs to, a shared number, one-tap replies.
4. A court: who calls it home, who is free this week, an invite button on each.
5. It's on: the confirmed hit with Add to calendar, Directions, Share, Message, and the plan.
6. Messages: every conversation, with what you have not read.
7. The family view: each child, what needs a parent's OK, and their age setting.
8. Coach tools: the academy's join code, pairs we would suggest, and the roster.
