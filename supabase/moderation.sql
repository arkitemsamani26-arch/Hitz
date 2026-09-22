-- Moderation queue. Run these in the SQL editor as the project owner (service role).
-- A report button with nobody behind it is worse than none: someone reads this daily.
--
-- Everything here is service-role only. There is no path from a signed-in user to any of
-- it, and test 16 is what keeps that true.

-- 1. The queue. Minors first, oldest first.
select * from app.moderation_queue;

-- 2. Everything about one report: the thread both sides wrote.
-- \set rid '<report id>'
-- select m.created_at, p.display_name, m.body
--   from app.hit_messages m
--   join app.profiles p on p.id = m.sender_profile_id
--  where m.hit_request_id = (select hit_request_id from app.reports where id = :'rid')
--  order by m.created_at;

-- 3. Decide. One call, whichever way it goes.
--
-- Suspending also cancels every live hit that profile is in and tells the other side
-- theirs is off -- which is the part that used to get forgotten, leaving somebody at a
-- court on Saturday waiting for a player who no longer exists. It returns how many hits
-- it cancelled, so the blast radius is visible rather than guessed at.
--
-- Either way the reporter is told their report was read. That is the promise the button
-- makes ("goes to a person, same day"), and a reporter who never hears anything learns
-- not to bother next time.
--
-- select app.review_report(:'rid', 'suspend', 'suspended: repeated abuse in thread');
-- select app.review_report(:'rid', 'dismiss', 'no basis; counterparty misread a joke');

-- 4. Profiles the auto-hide rule took down that no human has ruled on yet.
--
-- Three distinct reporters in thirty days hides a profile automatically. Erring toward
-- false positives is right, but only because a person clears this list every day: each
-- row is somebody locked out by a machine. This is the list that must reach zero.
select * from app.moderation_auto_hidden;

-- Dismissing the LAST open report against an auto-hidden profile should usually put them
-- back. Passing true does it in the same call, so a cleared name does not stay hidden
-- because nobody remembered a fourth statement.
-- select app.review_report(:'rid', 'dismiss', 'all three reports were one group pile-on', true);

-- Reinstating outside a report decision (an appeal, a mistake of ours):
-- select app.reinstate_profile('<profile id>');

-- Suspending outside a report (something you found yourself):
-- select app.suspend_profile('<profile id>');

-- 5. Density by cohort, and where the signups actually came from.
select * from app.market_cohort_density;
select * from app.invite_funnel;
