-- The app's Supabase client is written against these names. If one changes here, the
-- app breaks at runtime with a PostgREST 404, so pin them.
begin;
select plan(24);
set search_path = app, public;

select has_function('app', 'discover', array['integer','numeric','numeric','integer','boolean','interval','integer','integer'], 'discover(p_radius_m, p_level_lo, p_level_hi, p_availability, p_only_looking, p_active_within, p_limit, p_offset)');
select function_lang_is('app', 'discover', array['integer','numeric','numeric','integer','boolean','interval','integer','integer'], 'sql');
select has_function('app', 'my_market_status', '{}'::text[], 'my_market_status()');
select has_function('app', 'set_my_location', array['double precision','double precision'], 'set_my_location(p_lat, p_lon)');
select has_function('app', 'touch_me', '{}'::text[], 'touch_me()');
select has_function('app', 'stamp_phone_verified', '{}'::text[], 'stamp_phone_verified()');
select has_function('app', 'set_push_token', array['text'], 'set_push_token(p_token)');
select has_function('app', 'create_roster', array['text','integer'], 'create_roster(p_name, p_cap)');
select has_function('app', 'check_roster_code', array['text'], 'check_roster_code(p_code)');
select has_function('app', 'redeem_roster_code', array['text'], 'redeem_roster_code(p_code)');
select has_function('app', 'hit_assurance', array['uuid'], 'hit_assurance(p_hit)');
select has_function('app', 'accept_guardian_link', array['uuid'], 'accept_guardian_link(p_link)');
select has_function('app', 'mark_guardian_link_opened', array['uuid'], 'mark_guardian_link_opened(p_link)');
select has_function('app', 'revoke_guardian_link', array['uuid'], 'revoke_guardian_link(p_link)');

-- Named parameters are what PostgREST matches on.
select is((select string_agg(p, ',' order by o) from unnest(proargnames) with ordinality as t(p, o)
           where p like 'p\_%' escape '\'), 'p_radius_m,p_level_lo,p_level_hi,p_availability,p_only_looking,p_active_within,p_limit,p_offset')
  from pg_proc where proname = 'discover' and pronamespace = 'app'::regnamespace;
select is((select proargnames[1] from pg_proc where proname = 'redeem_roster_code' and pronamespace = 'app'::regnamespace), 'p_code', 'redeem_roster_code takes p_code');
select is((select proargnames[1] from pg_proc where proname = 'hit_assurance' and pronamespace = 'app'::regnamespace), 'p_hit', 'hit_assurance takes p_hit');

select has_column('app', 'hit_requests', 'decline_reason', 'hit_requests.decline_reason');
select has_column('app', 'hit_requests', 'plan', 'hit_requests.plan');
select has_column('app', 'hit_guardian_approvals', 'seen_at', 'hit_guardian_approvals.seen_at');
select has_column('app', 'profiles', 'roster_id', 'profiles.roster_id');
select has_column('app', 'guardian_links', 'opened_at', 'guardian_links.opened_at');
select has_column('app', 'profiles_private', 'push_token', 'profiles_private.push_token');
select has_table('app', 'notifications', 'notifications outbox');

select * from finish();
rollback;
