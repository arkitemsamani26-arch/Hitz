# Hits

**Find your next tennis match.**

UTR solved "how good is this player, really." Nobody solved "how do I actually find
that player and get on a court with them this week." Hits is that layer: discovery
and connection for tennis players, built on top of ratings that already exist.

The core loop is one sentence long:

> Open the app → see good players near you at your level → send a hit request → it's on the calendar.

Anything that doesn't serve that loop is not v1.

## What Hits is not

- **Not a rating system.** UTR (or a self-reported level) is an *input*. We will never
  compute a competing number. Rebuilding UTR is both a losing fight and beside the point.
- **Not tournament or league management.** Draws, brackets, scheduling engines — no.
- **Not a stats tracker.** We are not trying to be Strava for tennis. Light "hits this
  month" texture, yes; a dashboard of your winners and unforced errors, no.
- **Not a DM app.** Messaging exists to close a hit request, not to host conversations.

## Status

Pre-build. This repo currently contains the proposal set requested before scaffolding:

| Doc | What's in it |
| --- | --- |
| [`docs/01-product-scope.md`](docs/01-product-scope.md) | MVP (core loop) vs. full vision, and what gets deliberately cut |
| [`docs/02-design-directions.md`](docs/02-design-directions.md) | Three distinct visual/motion directions with reasoning, plus a recommendation |
| [`docs/03-tech-stack.md`](docs/03-tech-stack.md) | Recommended stack, alternatives considered, data model sketch |
| [`docs/04-safety-by-design.md`](docs/04-safety-by-design.md) | Minor-safety architecture — designed in, not bolted on |
| [`docs/05-open-questions.md`](docs/05-open-questions.md) | UTR API findings, payments call, and the decisions that need your input |

Read `01` and `04` first — they constrain everything else.
