-- Who may execute what, stated once instead of inferred.
--
-- Two things were wrong, and they are the same mistake from opposite ends: every grant in
-- this schema was resting on Postgres's default, which is EXECUTE to PUBLIC on every new
-- function.
--
-- 1. Roughly forty functions were reachable by `anon` -- discover, can_view_profile,
--    hit_assurance, shared_phone, profile_band -- because nothing ever took PUBLIC away.
--    None of them leak: each is SECURITY DEFINER and gates on app.uid(), which is null for
--    an anonymous caller, so they return nothing or raise. But the foundation migration
--    says in as many words "nothing in `app` is granted to anon/authenticated except the
--    explicit RPCs", and that was not true of the live project. A claim like that is only
--    worth anything if something enforces it.
--
-- 2. Worse, and in production right now: the hardening pass revoked EXECUTE from
--    `public` on the cron functions to stop a signed-in user expiring everybody's
--    requests. Correct -- except PUBLIC was the only grant those functions had, and
--    `service_role` is not a superuser, so the revoke took the scheduled jobs down with
--    it. `notify` calls enqueue_tomorrow_reminders() and expire_requests() every minute
--    and discards both results, so "hit tomorrow" reminders and request expiry have been
--    failing silently ever since, and utr-sync could never have worked at all.
--
-- ALTER DEFAULT PRIVILEGES was supposed to prevent (1) recurring. It does not: it applies
-- only to objects created afterwards, by the role that ran it, and migrations here do not
-- all run as that role. So the invariant is not left to a default any more -- test 17
-- asserts the exact executable surface for anon and for service_role, and any function
-- added later that forgets its grants fails the suite.

-- 1. Take back what was never deliberately given -----------------------------------------
revoke execute on all functions in schema app from public;
revoke execute on all functions in schema app from anon;

-- 2. The five that genuinely run before anyone has signed in ------------------------------
--
-- Two for the onboarding code field, one for the peek screen, two for the page a parent
-- opens from a text message before they have an account. Nothing else has a reason.
grant execute on function app.check_code(text)                        to anon, authenticated;
grant execute on function app.check_roster_code(text)                 to anon, authenticated;
grant execute on function app.peek_cohort(date, numeric, text)        to anon, authenticated;
grant execute on function app.guardian_link_preview(uuid)             to anon, authenticated;
grant execute on function app.mark_guardian_link_opened(uuid)         to anon, authenticated;

-- 3. What the server actually runs as the server -------------------------------------------
--
-- These stay unreachable from any client session -- that is the whole point of them -- but
-- the scheduled jobs and the reviewer's SQL do need to be able to call them. This is the
-- grant whose absence has been quietly breaking the outbox.
grant execute on function app.expire_requests()                                  to service_role;
grant execute on function app.enqueue_tomorrow_reminders()                       to service_role;
grant execute on function app.apply_utr(uuid, text, numeric, text, text, text) to service_role;
grant execute on function app.retire_utr(uuid)                                   to service_role;
grant execute on function app.utr_due_for_sync(int)                              to service_role;
grant execute on function app.review_utr_claim(uuid, boolean, numeric, text)     to service_role;
grant execute on function app.review_report(uuid, text, text, boolean)           to service_role;
grant execute on function app.suspend_profile(uuid)                              to service_role;
grant execute on function app.reinstate_profile(uuid)                            to service_role;

-- The reviewer's queues, same reasoning: readable by the server, by nobody else.
grant select on app.moderation_queue, app.moderation_auto_hidden, app.invite_funnel,
                app.utr_review_queue to service_role;

-- 4. Belt and braces, knowing it is only braces ---------------------------------------------
-- Still worth setting, still not something to rely on: it covers only what `postgres`
-- creates from here. Test 17 is the part that actually holds.
alter default privileges in schema app revoke execute on functions from public;
