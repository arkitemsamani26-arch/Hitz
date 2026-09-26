# 10. Outreach

Drafts, not templates to fire off unedited. Every one of them is short on purpose: the
demo link is the pitch, and the email exists only to get it opened.

**Before sending anything, fill in every `[bracket]`.** And send from a real address you
check — a reply arriving at an inbox you forgot about is the most common way this dies.

**On finding the right person:** I have not put email addresses in here, because I would
be guessing and a guessed address to a real company is worse than no email. Find them
yourself: UTR Sports' team is on LinkedIn, the Engage API page has a partner contact form,
and a junior-tennis coach who already knows someone beats every cold email below.

---

## 1. UTR Sports — cold, to product or partnerships

Subject lines that have a chance, pick one:

- `Junior safety layer for UTR — working app, 9 days, no ask for money`
- `A parent-approval flow for Create Play (built, not proposed)`

> Hi [name],
>
> I'm [age/year] and I build things. Over nine days this month I built Hits: a tennis
> matchmaking app for juniors, on top of UTR ratings.
>
> I know UTR already has Create Play and Find Play, so I'm not writing to pitch you
> matchmaking. I'm writing about the thing I couldn't find in any of them.
>
> In Hits, a hit between two minors doesn't exist as a time and a place until a parent
> approves that specific meeting. Minors and adults cannot see each other at all, and that
> rule is enforced by row-level security in the database rather than by a screen — so a bug
> in my interface can't leak a child. There are 184 automated tests holding those rules.
>
> It's live and you can open it on your phone in about ten seconds, no install:
> [demo link]. Sign in with any number, the code is 000000. Send a hit request, then look
> at the parent's view.
>
> Given the app store accountability laws that came in this year covering under-18s, I'd
> guess this is already on someone's roadmap at UTR. If it is, I'd like twenty minutes to
> show you what I built and hear where I got it wrong. If it isn't, that's probably the
> more interesting conversation.
>
> I'm not asking for money. I'd honestly rather work on this with you than sell it to you.
>
> [name]
> [phone] · [link to code, if you're comfortable sharing it]

**Why it's written that way.** Naming Create Play first is what stops it reading like
someone who never opened their app — that is the single most common reason this kind of
email gets deleted. "Not asking for money" removes the reflex to forward it to whoever
handles inbound pitches. "Where I got it wrong" gives a busy person an easy, low-stakes
reason to reply.

---

## 2. UTR Engage API — the developer application

This is the official door and it is cheap. There is an application, and the published
fee for applicants without the prerequisites is $250, non-refundable. Worth it: the reply
itself tells you where you stand.

> Hi,
>
> I'd like to apply for Engage API access.
>
> What I've built: Hits, a hitting-partner app for junior players that uses UTR as its
> level. It's working — [demo link] — with the full loop from finding a player at your
> level to a confirmed hit.
>
> What I want the API for is narrow: verifying that a player's stated UTR is actually
> theirs, so a verified badge means something. Today I do that by hand — a player submits
> their rating and a link to their profile, and I check it against utrsports.net before the
> badge is granted. It works, but it doesn't scale past a few hundred players, and a
> verified number is the thing the whole product rests on.
>
> I know "stable user base" is one of the criteria and I want to be straight with you: I
> don't have one yet. I'm launching into junior tennis in [market] and I'd rather ask now
> and be told to come back later than build further on a hand-checked rating.
>
> Happy to answer anything about how it's built.
>
> [name]

**Why it's written that way.** Volunteering the thing that disqualifies you, before they
find it, is what makes the rest credible. It also converts a "no" into a "not yet, come
back at X" — which is a far more useful answer than silence.

---

## 3. The warm intro — send this to anyone who might know someone

Much higher hit rate than either of the above. Keep it to one screen; make it trivially
forwardable.

> Hi [name],
>
> Quick favour, and an easy no.
>
> I built a tennis app for junior players — it finds you someone at your level and makes a
> parent approve every meetup before it's real. It's working and takes ten seconds to look
> at: [demo link].
>
> Do you know anyone at UTR Sports, or any junior coach or academy director who'd have an
> opinion on it? I'm after two things: somewhere to pilot it with real juniors, and someone
> at UTR who'd tell me whether this is useful or already handled.
>
> If nobody comes to mind, no problem at all — and if you've got two minutes to open it and
> tell me what's bad, that's worth as much.
>
> [name]

---

## 4. A club, academy or high-school coach — the pilot

**Send this one first.** Fifty real juniors changes every other conversation in this file,
and nothing in the UTR conversation gets easier while the number of users is zero.

> Hi [name],
>
> I'm [name], [context — a player at X / a student at Y / I train at Z].
>
> I built an app for junior players to find someone at their level to hit with. The part I
> care about is that a parent approves each meetup before it happens, and adults and juniors
> can't see each other at all.
>
> I'd like to try it with [team/academy] — free, no catch, and I'll turn it off the moment
> it's annoying. What I need is about [15] players and their parents, for [three] weeks.
> What you'd get is your group finding hits without the group chat.
>
> It's here if you want to look before deciding: [demo link].
>
> Could I come and show you in person? I'm around [days].
>
> [name]

**Why it's written that way.** A coach's real fear is a parent complaint, so parent
approval leads. "I'll turn it off the moment it's annoying" removes the risk of saying
yes. In person beats a link, every time, at this scale.

---

## What to expect

- **Cold email to a funded company: most get no reply.** That is normal and not about you.
  Two or three follow-ups, a week or two apart, are fine. More than that is not.
- **The pilot emails will work better than the UTR ones**, and they are what make the UTR
  ones work later.
- **If someone replies, reply the same day.** Momentum is most of it.
- **Never attach the deck to a cold email.** Link the app. The app is the differentiator;
  a deck is what everyone else sends.
