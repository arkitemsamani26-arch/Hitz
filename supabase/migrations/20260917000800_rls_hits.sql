-- RLS for the hit lifecycle.

alter table app.hit_requests            enable row level security;
alter table app.hit_request_revisions   enable row level security;
alter table app.hit_messages            enable row level security;
alter table app.hit_guardian_approvals  enable row level security;
alter table app.hit_confirmations       enable row level security;

grant select, insert, update on app.hit_requests to authenticated;
grant select, insert on app.hit_request_revisions to authenticated;
grant select, insert on app.hit_messages to authenticated;
grant select, update on app.hit_guardian_approvals to authenticated;
grant select, insert on app.hit_confirmations to authenticated;

-- Participants see their own requests. Guardians see their child's -- full visibility,
-- not summaries.
create policy hit_requests_select on app.hit_requests
  for select to authenticated
  using (
    app.uid() in (from_profile_id, to_profile_id)
    or app.is_guardian_of(from_profile_id)
    or app.is_guardian_of(to_profile_id)
  );

-- Every safety rule that governs discovery governs contact. A user who cannot see a
-- profile cannot reach it, and the check is here rather than in the client.
create policy hit_requests_insert on app.hit_requests
  for insert to authenticated
  with check (
    app.can_request_hit(from_profile_id, to_profile_id)
    and exists (
      select 1 from app.courts c
       where c.id = court_id
         and c.is_active
         and (c.access <> 'private')
         -- Minors' hits are restricted to public and club courts.
         and (app.profile_band(from_profile_id) = 'adult' or c.access in ('public','club'))
    )
  );

create policy hit_requests_update_participant on app.hit_requests
  for update to authenticated
  using (app.uid() in (from_profile_id, to_profile_id))
  with check (app.uid() in (from_profile_id, to_profile_id));

create policy hit_revisions_select on app.hit_request_revisions
  for select to authenticated using (app.is_hit_participant(hit_request_id) or app.is_hit_guardian(hit_request_id));

create policy hit_revisions_insert on app.hit_request_revisions
  for insert to authenticated with check (by_profile_id = app.uid() and app.is_hit_participant(hit_request_id));

-- Threads: participants write, guardians read.
create policy hit_messages_select on app.hit_messages
  for select to authenticated
  using (app.is_hit_participant(hit_request_id) or app.is_hit_guardian(hit_request_id));

create policy hit_messages_insert on app.hit_messages
  for insert to authenticated
  with check (
    sender_profile_id = app.uid()
    and app.is_hit_participant(hit_request_id)
    and exists (
      select 1 from app.hit_requests h
       where h.id = hit_request_id
         and h.state in ('pending', 'countered', 'accepted', 'confirmed')
         and not app.blocked_between(h.from_profile_id, h.to_profile_id)
    )
  );

-- Only the named guardian decides, and only for their own child.
create policy hit_guardian_approvals_select on app.hit_guardian_approvals
  for select to authenticated
  using (
    guardian_user_id = app.uid()
    or minor_profile_id = app.uid()
    or app.is_hit_participant(hit_request_id)
  );

create policy hit_guardian_approvals_update on app.hit_guardian_approvals
  for update to authenticated
  using (guardian_user_id = app.uid() and app.is_guardian_of(minor_profile_id))
  with check (guardian_user_id = app.uid() and app.is_guardian_of(minor_profile_id));

create policy hit_confirmations_select on app.hit_confirmations
  for select to authenticated
  using (app.is_hit_participant(hit_request_id) or app.is_hit_guardian(hit_request_id));

create policy hit_confirmations_insert on app.hit_confirmations
  for insert to authenticated
  with check (profile_id = app.uid() and app.is_hit_participant(hit_request_id));
