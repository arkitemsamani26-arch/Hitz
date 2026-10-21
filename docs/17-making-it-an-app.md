# 17. Making it feel like an app

October 2026. The brief, in the owner's words: the app "doesn't really feel like an app".
UTR has "so many buttons, so many things I can do, I know where to go". Hits needed more
places to go and more to do, and a list of specific fixes: the player card's design, the
face on it ("not a circle, it's weird"), who brings the balls, better messaging with phone
numbers inside it, a family profile for parents, and younger kids hitting with kids their
own age.

This is what changed, why, and how it was checked.

## Five places to go

The tab bar went from three tabs to five, the shape of a sports app:

| Tab | What it is for |
| --- | --- |
| Discover | Shortcuts (Search, Courts, "I'm free", Doubles, Events), your next hit, the player we would hand you, everyone free this week in a row you can swipe, then everyone nearby. |
| Courts | Every court in the area, how far from yours, and how many players you could invite call it home. Your home court sits on top. |
| My hits | Unchanged in purpose: what is waiting on you, on them, coming up, and past. |
| Messages | Every conversation, newest first, with unread counts. The tab shows a red badge with the number. |
| Profile | Your player card, then grouped settings with icons: your game, family (juniors), rating, friends and teams, account. |

New screens behind them: a court page (`/court/[id]`) with who plays there and an Invite
button on each player that pre-picks that court; a conversation (`/chat/[id]`); search
(`/search`) for a player's name or a court.

## The player card

Every face is a circle now (`src/ui/Avatar.tsx`). The arch, round on top and square at the
bottom, is gone everywhere. A small green dot on a face means "looking to hit this week".

The card (`src/ui/MemberCard.tsx`) was a name and a rating on green. It is now the card
other players see when they open your profile: your photo or initials in a ringed circle,
name, area and home court, a junior's age, then three numbers a partner actually cares
about (rating with its source, hits played on Hits, how often you reply), and a footer line
for "looking this week" and what you are here for. A brand-new player shows "New" rather
than a reply rate of 0% for an invitation they have not had a chance to answer.

The same card heads a player's profile, followed by "You two" (how far apart your levels
are, both ages for juniors, how many times you have hit together) and your hits together.

## Who brings the balls

Whoever sends the invitation brings the balls. It is set by the database when the
invitation is created (`app.default_hit_plan`, a BEFORE INSERT trigger), so every client
agrees, and the demo does the same. It shows on the invitation ("Balls: You bring them"),
on the receiving side ("Kenji brings them. Kenji asked, so they bring the balls."), in the
conversation's header card, and in the plan, where either player can switch it once the hit
is on.

## Messages

Messages were a list at the bottom of the hit page with a text box. Now:

- **A Messages tab** with every conversation, the last line, the time ("6:42 pm",
  "Yesterday", "Monday"), the hit it belongs to, and an unread count. Unread is real: the
  server keeps a read marker per player per hit (`app.hit_reads`, written by
  `app.mark_hit_read`, read by `app.inbox`).
- **A conversation screen**: the hit at the top (tap to open it), messages grouped by
  sender with day dividers and times, one-tap replies that change with the moment ("Does
  that time work?" before it is agreed, "On my way" and "Running 5 minutes late" on the
  day), and a box that grows as you type.
- **Phone numbers live in the conversation**, where you would think to ask for one: the
  other player's shared number with Text and a call button in the header, and Share my
  number / Hide for yours. Still off by default, one confirmed hit at a time.
- Juniors are told, in the thread, that their parent can read it.

Messaging stays tied to a hit. There are no open DMs to strangers; a conversation opens
with an invitation.

## Families

The parent's home is now a family view (`app/guardian/index.tsx`): a row with each child
(face, name, age, a badge for anything waiting) and an "Add a child" card that shares the
sign-up steps with the parent's number filled in. For the chosen child: their card, what
needs an OK, what is on the calendar, and one setting, **who they can hit with**: within 1,
2 or 3 years of their age, or any age under 18.

That setting is enforced by the database, not hidden by the app. A parent sets it through
`app.set_child_age_gap`; the child's own profile update cannot touch it (trigger
`profiles_parent_owned`). `app.age_gap_ok` applies the stricter of the two children's rules,
both ways, in discovery and when sending an invitation (`app.can_request_hit`).

## Juniors and age

Juniors see each other's age in years (never the date), on cards, rows, profiles and in
the conversation header. Discover starts a junior on players within two years of their own
age ("UTR 8.4 · ages 12–16" says so beside the heading), the featured card leads with
"Your age" or "Around your age" when it is true, and Filters has an Age section to widen it.
A parent's rule stays underneath whatever the junior picks. Adults' ages are not shown to
anyone; nobody needs them to find a partner.

## A privacy fix found on the way

Row-level security decided *which* profiles another player could read, but nothing decided
*which columns*. A signed-in player could ask the API for a peer's exact date of birth, the
photo a parent had not approved yet, and the grid cell their location was rounded to. The
migration now grants other players only the columns the app shows; your own whole row comes
through `app.my_profile()`, and a parent's children through `app.my_children()`. Discovery,
which needs the location cell and birthdays to compute distance and age, runs as the owner
and applies the visibility rule itself.

The privacy policy (`legal/privacy.html`) now says that junior ages are shown to other
juniors, that read markers exist, that courts show counts of players, and that a parent can
set the age range.

## Live database

Migration `20261013000100_family_and_messages.sql` is applied to the live project. The
hosted SQL tool holds any `DROP` for a person to approve, so instead of dropping the old
eight-argument `app.discover` the migration renames it to `app.discover_v1` and revokes it
from every client role. It cannot run anyway. Drop it by hand whenever convenient:

```sql
drop function app.discover_v1(int, numeric, numeric, int, boolean, interval, int, int);
```

## Checks

| Check | Result |
| --- | --- |
| Database tests (pgTAP) | 252 assertions pass, 31 of them new (`supabase/tests/21_family_and_messages.sql`) |
| Type check | Clean |
| Android and iOS bundles (`expo export`) | Both build |
| Accessibility (axe, 18 screens) | Zero violations, after fixing one contrast issue in the number card |
| Crawl (every button on every screen) | Every button does something and nothing throws, after making quick replies send and raising them to 44 points |
| Screens at 320 px, 390 px, dark mode | Checked by eye; fixed truncated court rows and the home-court card's footer |

Screenshots of every main screen are in `docs/shots/`, and the seven store screenshots in
`docs/store/` now show Discover, a player card, a conversation, a court, a confirmed hit,
Messages and the family view.

## Coaches

Asked for after the first pass: a coach, the way CoachNow links a coach and their students,
who can pair two of their players to hit together.

**Coach tools** (`/coach`, from Profile, adults only): name your academy or team and you get
a join code ("PENIN86"). The dashboard shows the code with a Share button, your players with
their level, age (juniors) and usual times, **pairs we would suggest** (same side of 18,
within a point of each other, free at the same times, juniors within two years, nobody in
more than two suggestions), and every pairing you have made with where it got to: sent to
both, invite sent, with the parents, it's on, played, or passed.

**Pairing** (`/coach/pair`): pick two players (the second list ranks who fits the first and
says why), suggest a time or let them pick, choose a court (halfway between their home courts
by default), add a note. Both get it as a push and as a card at the top of Discover: "Hit with
Theo K.", the time and court, the coach's note, and **Send the invite**, which opens an
ordinary invitation already filled in. From there it is their hit: they talk, a parent
approves a junior's hit, it's on. The coach sees the hit's state, never the conversation.

**Joining** (`/coach/join`, from Profile): type the code, see whose academy it is, join.

**Juniors.** A coach is an adult, and the rule is that no adult finds or contacts a junior.
So a junior appears on a coach's roster only when all three hold: the junior joined with the
code, their parent approved that coach by name (in the family view), and a person at Hits
has verified the coach (`coaches.juniors_verified_at`, which only the server can set). Until
then the coach sees a first name and "waiting on their parent" or "waiting on Hits", nothing
more. A coach can never message anyone, can never pair a junior with an adult, and a
parent's age rule applies to pairings exactly as it does to invitations. A parent can remove
a coach at any time, which takes their child off the roster and withdraws open pairings.

**To verify a coach for juniors** (owner task, after checking who they are):

```sql
update app.coaches set juniors_verified_at = now() where code = 'PENIN86';
```

Migration `20261014000100_coaches.sql`; 30 tests in `supabase/tests/22_coaches.sql`.

## Looking to hit

`/looking`, from "See all" beside "Free this week" on Discover: everyone who said they want
to play this week, each with their usual week as six small squares (weekday and weekend,
morning, afternoon, evening). Solid squares are times you are both free; outlined ones are
only them. It opens filtered to when you are free, sorted by how much you overlap, with
chips for any single time and an Invite button on every row. Your own "I'm free this week"
switch sits at the top.

## Supabase security emails (October 2026)

The "security vulnerabilities detected" emails come from Supabase's advisor. Every finding
is about the `public` schema, not the app's own tables:

- `public.spatial_ref_sys` (PostGIS's list of map projections) has no row-level security.
- `public.st_estimatedextent` (a PostGIS helper) can be called through the API.
- `postgis`, `citext` and `pg_net` are installed in `public`.

Supabase's admin role owns these and granted access to them, so the project's `postgres`
role cannot revoke it (tried; it has no effect). The app never uses `public`: every call
goes to the `app` schema (`db: { schema: 'app' }` in `src/data/supabase.ts`). The fix is
to stop exposing `public` to the API:

**Dashboard → Project Settings → Data API → Exposed schemas: remove `public`, keep `app`.**

The remaining "RLS enabled, no policy" notes are informational and intended: those tables
(coaches, pairings, notifications, private profile fields and so on) are reachable only
through the app's checked functions, never read directly.

## Doubles and tournaments

Asked for next: "a tournament this weekend" feature for kids, like USTA, that spots another
kid playing the same doubles tournament; and, for everyone, a way to say singles or doubles
and find a partner and opponents in your age range.

**Singles or doubles.** Every profile now says `singles`, `doubles` or `either`
(`profiles.play_format`, default `either`). It is set from Profile or from the top of
Looking to hit, which also has a "Doubles players" filter. Discover has a Doubles shortcut
that opens Looking to hit on doubles players.

**A doubles game is four people and three invitations.** Rather than a new kind of hit,
a game is up to three ordinary invitations from one organizer that share a `match_id`: one
partner and two opponents (`hit_requests.format`, `match_id`, `doubles_role`). Each one
keeps everything a hit already has: its own conversation, its own parent approvals, phone
sharing, blocks. The first doubles invitation starts the game; its id is the game's id.

The rule that matters is in the database (`app.guard_doubles`, a BEFORE INSERT trigger):
nobody joins a game unless **every** player already in it could have invited them: same
side of 18, nobody blocked, and every parent's age rule (`app.pair_ok`). So a 16-year-old
whose parent allows two years cannot end up across the net from a 13-year-old just because
the organizer has no rule of their own. One partner, two opponents at most; only the
organizer invites; a sent invitation cannot change format.

On the hit page a doubles hit shows the court: your side, the net, across the net, each
spot's state, and "Find opponents" / "Find a partner" for the organizer. That opens
`/doubles/[id]`: players who said doubles or either, who fit everyone in the game, closest
to the team's average level, then most usual times in common (`app.suggest_doubles`, built
on `app.discover`, so it inherits every discovery rule). `app.doubles_match` returns the
four for anyone in the game or a parent of one.

**Tournaments** (`/tournaments`, from Discover's Events shortcut and Profile). A player
adds the tournament they are playing (name, first day, how many days, optional place and
https link; the same name and day is the same tournament), then enters it: division (free
text: 14U, B16, 4.0), singles and/or doubles, and "still looking for a doubles partner".
The tournament page lists the other players in it **that you could already find on Hits**
(`app.tournament_players`), your division and partner seekers first, with "Ask to partner"
(a doubles invitation, filled in with "Partner for <name>?" and a practice the evening
before) or "Practise". Discover shows "Playing this weekend" when you are entered in one
within the week. In the family view a parent sees their child's entries and can take them
off.

Nothing here comes from USTA or any tournament site; the screens say so ("Added by a player
on Hits. Check entries and the draw with the organizer."). Juniors only ever see juniors,
adults only adults, and a parent's age rule hides their child from older players at the
tournament too.

Migration `20261020000100_doubles_and_tournaments.sql` (applied live in four parts); 36
tests in `supabase/tests/23_doubles_and_tournaments.sql`. The demo has three made-up local
tournaments dated from today and a mix of singles and doubles players.

## Hits Plus

One paid plan, **$4.99 a month**, and one rule above it: a free player still gets a hit
every week. Nothing about receiving or answering invitations, messages, phone sharing,
parent approvals, safety, blocking, reporting, tournaments, doubles partners, the family
view or the coach tools is behind it. Nobody pays to be safe or to be found.

**What free keeps, and where Plus starts.** Enforced in the database (migration
`20261021000100_plus.sql`), not hidden in the app; each limit raises an error whose message
starts `plus_required:<why>`, which the app turns into the paywall (`src/lib/plus.ts`).

| Free | Plus |
| --- | --- |
| Three invitations waiting on a reply at once (a doubles game counts once) | As many as you like |
| Distance, level, when you are free, a junior's age range, "looking this week" | Also playing style, hand, reply rate, indoor courts, singles or doubles players |
| The five best fits on Looking to hit | Everyone, with their week next to yours |
| "I'm free" for three days | Seven |
| Your last five hits | Every hit, plus `/stats`: hits per month, who you play most, your level over time |
| | Saved searches (up to five) with a daily push when a new player who fits joins |
| | Private notes on partners, only you see |
| | A fuller card: style, hand, a line about you, an action photo, the Plus badge |
| | **Auto-match**: say when, who and how far; Hits invites the best fit, and if they pass, the next, until one says yes or the time passes |

Auto-match sends ordinary invitations as you (`app.auto_match_next` runs as the owner, so
`can_request_hit`, the age gap, blocks, the court rule and every trigger apply), one at a
time, each expiring within a day; `app.advance_auto_matches` runs every ten minutes. Saved
searches run once a day (`app.run_saved_searches`), only for new players. Both jobs are
scheduled by pg_cron with the others.

**Juniors never buy.** A child's Plus comes through a linked, verified parent who has it
(`app.is_plus` checks the guardian), and one plan on the parent's sign-in covers every child
they manage. Where an adult sees the paywall, a child sees "Ask your parent", which sends the
parent a push and shows in the family view; `app.begin_purchase` refuses a minor outright.

**Subscriptions** live in `app.subscriptions`, keyed by the auth user (a parent may have no
player profile), with no client access at all. The only writer is the RevenueCat webhook
(`supabase/functions/revenuecat`, deployed; it refuses every call until its secret is set)
through `app.apply_subscription`, which only the service role may call. The app uses
`react-native-purchases` on a phone and a stub on the web (`src/lib/purchases*.ts`); the
RevenueCat app user id is the Supabase user id, so the webhook needs no lookup.

The demo has no store: a switch on `/plus` stands in for a purchase and says so.

Checks: 42 tests in `supabase/tests/24_plus.sql` (366 in all); accessibility clean on 32
screens; the button crawl clean on the new and changed screens; web, Android and iOS exports
build.

**Owner tasks before Plus can be sold**

1. App Store Connect: accept the Paid Apps agreement and add banking and tax details. Play
   Console: set up a merchant account.
2. Create the subscription in both stores: product id `hits_plus_monthly`, $4.99 a month,
   one subscription group. Add the App Store product to a RevenueCat offering as the
   `monthly` package, with an entitlement called `plus`.
3. RevenueCat: one project, Apple and Google apps, and the public SDK keys. Put them in the
   build as `EXPO_PUBLIC_REVENUECAT_IOS` and `EXPO_PUBLIC_REVENUECAT_ANDROID` (eas.json
   `env`, or EAS secrets). With neither set, the paywall says Plus is not for sale yet.
4. RevenueCat → Integrations → Webhooks: URL
   `https://pvkzcbgpbebllnzmxxwg.supabase.co/functions/v1/revenuecat`, and an Authorization
   header value of your choosing. Put the same value in Supabase → Edge Functions →
   Secrets as `REVENUECAT_WEBHOOK_SECRET`. Never in a file.
5. To give someone Plus by hand (a tester, a promo): from the SQL editor,
   `select app.grant_plus_promo('<auth user id>', 30);`.
6. Fill in the Terms (the Money section now describes the subscription) and the privacy
   policy brackets, and publish them: the paywall links to both, as Apple requires.

## Parent-run accounts

Asked for after Plus: "the parents are the ones that create the account for the kid, and it
goes to their number... if the kid is really young. At other ages you can make your own
account, but there'll be an option at the start: this is for my kid, or this is for me."

**The first screen asks.** *This is for me* is the flow as it was (an adult, or a teen of 13
or more with their own number who links a parent). *This is for my kid* signs the parent in
with their own number and goes straight to **Add your child** (`/family/add`): first name,
last initial, birthday, level, home court, usual times, singles or doubles. The child needs no
phone and no sign-in. A parent can add up to six.

**Under 13 is parent-run only.** The database refuses a self-made profile with a birthday
under 13 (`profiles_self_signup` trigger, error `under_13:`); the birthday step says why and
tells the child to ask a parent to choose "This is for my kid".

**Using the app as the child.** The family view has *Use Hits as Mia* on each child the parent
runs; Profile shows a "Use Hits as" row, and while switched a green bar on Discover and
Profile says *Using Hits as Mia* with a Switch button. Everything (Discover, invitations,
messages, doubles, tournaments, coaches) is then the child's.

How the server knows: every rule asks `app.uid()` who the player is. It now resolves an
`x-hits-as` request header, sent by the app while switched, to the named child **only if**
`profiles.managed_by` is the signed-in login and the child is active; anything else is
refused with 42501. Being a parent is about the login, so every guardian check
(`is_guardian_of`, approvals, links) asks `auth.uid()` directly and works whether or not the
parent is switched. `managed_by` cannot be read by other players or written by any client.

**Safety is unchanged.** A run child is a minor like any other: same band, same age rule
(the parent sets it in the family view), same discovery. The parent is the child's verified
guardian from the start. Sending or accepting a hit *as* the child counts as the parent's
approval for that child at that court and time (`hit_requests.owner_approved`, set only by a
trigger); a counter to a new time clears it, as it clears any approval. The other family's
parent still approves their own child. In a conversation the other side is told *A parent
runs Mia's account*; the parent sees *You're writing as Mia*.

**Pushes** for a run child go to the parent's phone, titled with the child's name
("Mia: Theo wants to hit"), and tapping one opens the app as that child. Tokens now live by
login (`app.device_tokens`), which also fixes pushes for parents who never made a player
profile; the notify function reads those first.

**Plus** bought by the parent covers every child they run. Switched to a child, the paywall
says to switch back and buy as yourself.

**Their own sign-in at 13.** *Give Theo his own sign-in* takes the child's number. When the
child signs in with it, `claim_handoff` moves the profile (with its hits, messages, entries
and rating) to that login (`app.profile_logins`), and the parent stays linked as their
parent, approving their hits, but no longer runs the account.

**Removing a child** (family view, or *Remove Mia's account* on her Profile while switched)
deletes the child's account exactly as a player's own deletion does. Deleting the parent's
account deletes every child account they run (`managed_by` cascades from the login).

Migration `20261022000100_parent_run_accounts.sql`; 48 tests in
`supabase/tests/25_parent_run.sql`. Known gap: a child who was handed their own sign-in and
later deletes their account leaves an empty login row (their profile and everything in it are
gone). To clear those by hand:

```sql
select u.id, u.phone, u.created_at from auth.users u
 where not exists (select 1 from app.profiles p where p.id = u.id)
   and not exists (select 1 from app.profile_logins l where l.user_id = u.id)
   and not exists (select 1 from app.guardian_links g where g.guardian_user_id = u.id);
```

The privacy policy has a new section, *Accounts a parent runs*. As with the rest of it,
have someone qualified read it before launch: an under-13 account run by a parent is
collecting a child's information with the parent's consent, which is the part of children's
privacy law (COPPA in the US) a reviewer will look at most closely.
