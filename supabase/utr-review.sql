-- The UTR review desk.
--
-- Run these in the Supabase SQL editor, which connects as a role that can reach
-- app.review_utr_claim. Nothing here is callable from the app, and that is the point:
-- a player can state their UTR, and only a person can grant the badge.
--
-- Doing a review, start to finish:
--
--   1. Read the queue below. Each row has the player's claimed UTR, the link to their
--      UTR profile, and the name that should be on it.
--   2. Open the profile link. Check three things:
--        - the name matches what they told us
--        - the rating matches what they claimed (within about 0.2; UTR moves weekly)
--        - the profile looks like a real playing record, not an empty account
--   3. Approve or reject with one of the statements further down.
--
-- For anyone under 18, be stricter: the level decides who they get matched with, so an
-- inflated number puts a fourteen-year-old across the net from a college player.

-- The queue --------------------------------------------------------------------------
select * from app.utr_review_queue;

-- The third argument is you. It is required, and it is not inferred: app.uid() is null in
-- the SQL editor, so a decision that does not name its reviewer records one as nothing.
--
-- Approve, taking the rating they claimed:
--   select app.review_utr_claim('<claim_id>', true, 'sam@hits');
--
-- Approve, but with the number you actually saw on their profile:
--   select app.review_utr_claim('<claim_id>', true, 'sam@hits', 8.42);
--
-- Reject, with a reason the player will read:
--   select app.review_utr_claim('<claim_id>', false, 'sam@hits', null,
--     'That profile is under a different name. Send the link to your own UTR page.');

-- Common rejections, worded so they tell the player what to do next -------------------
--
--   'We could not open that link. Copy it from the address bar of your UTR profile.'
--   'The name on that profile is not yours. Send us your own UTR page.'
--   'That profile has no rating yet. Play a few rated matches and come back.'
--   'UTR shows a different number. Submit the one on your profile and we will verify it.'

-- Who has the badge, and how they got it ----------------------------------------------
select p.display_name, p.last_initial, p.level_value, p.utr_verified_by, p.utr_verified_at
  from app.profiles p
 where p.level_source = 'utr_verified'
 order by p.utr_verified_at desc nulls last;

-- Recently decided, in case you need to look back at one -------------------------------
select c.id, p.display_name, c.claimed_rating, c.decided_rating, c.state, c.reviewer_note, c.decided_at
  from app.utr_claims c
  join app.profiles p on p.id = c.profile_id
 where c.state in ('approved', 'rejected')
 order by c.decided_at desc
 limit 50;

-- Taking a badge back, if a claim turns out to be wrong ---------------------------------
--   select app.retire_utr('<profile_id>');
-- That clears the badge and drops the level back to self-reported, keeping the number.
