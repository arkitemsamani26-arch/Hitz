-- Moderation queue. Run these in the SQL editor as the project owner (service role).
-- A report button with nobody behind it is worse than none: someone reads this daily.

-- 1. The queue, minors first, oldest first.
select r.id, r.created_at, r.reason, r.involves_minor, r.body,
       rp.display_name as reported, rp.status as reported_status,
       (select count(*) from app.reports x where x.reported_profile_id = r.reported_profile_id and x.created_at > now() - interval '30 days') as reports_30d,
       r.hit_request_id
  from app.reports r
  join app.profiles rp on rp.id = r.reported_profile_id
 where r.state = 'open'
 order by r.involves_minor desc, r.created_at;

-- 2. Everything about one report: the thread, both profiles' history.
-- \set rid '<report id>'
-- select m.created_at, p.display_name, m.body from app.hit_messages m join app.profiles p on p.id = m.sender_profile_id
--  where m.hit_request_id = (select hit_request_id from app.reports where id = :'rid') order by m.created_at;

-- 3. Act. Suspend (hidden from discovery, cannot act) or dismiss. Always leave a resolution.
-- update app.profiles set status = 'suspended' where id = '<profile id>';
-- update app.reports set state = 'actioned', reviewed_at = now(), resolution = 'suspended: ...' where id = :'rid';
-- update app.reports set state = 'dismissed', reviewed_at = now(), resolution = '...' where id = :'rid';

-- 4. Reinstate after review.
-- update app.profiles set status = 'active' where id = '<profile id>';

-- 5. Auto-hidden profiles (3+ distinct reporters in 30 days) awaiting a human.
select p.id, p.display_name, p.status, count(distinct r.reporter_profile_id) as reporters
  from app.profiles p join app.reports r on r.reported_profile_id = p.id
 where p.status = 'suspended' and r.created_at > now() - interval '30 days'
 group by p.id order by reporters desc;

-- 6. Density by cohort and by roster (where signups came from).
select * from app.market_cohort_density;
select ro.name, count(p.id) as joined, ro.cap from app.rosters ro left join app.profiles p on p.roster_id = ro.id group by ro.id order by joined desc;
