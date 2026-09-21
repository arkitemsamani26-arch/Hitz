-- Photos of minors are approved by the parent before anyone else sees them. A minor's
-- new photo lands in photo_pending_url; the guardian approves it into photo_url (or
-- removes it). Adults' photos publish immediately.
alter table app.profiles add column photo_pending_url text;

create or replace function app.set_my_photo(p_url text)
returns void language plpgsql security definer set search_path = app, public as $$
begin
  if p_url is null then
    update app.profiles set photo_url = null, photo_pending_url = null where id = app.uid();
  elsif app.profile_band(app.uid()) = 'minor' then
    update app.profiles set photo_pending_url = p_url where id = app.uid();
  else
    update app.profiles set photo_url = p_url, photo_pending_url = null where id = app.uid();
  end if;
end; $$;
grant execute on function app.set_my_photo(text) to authenticated;

create or replace function app.guardian_approve_photo(p_child uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = app, public as $$
begin
  if not app.is_guardian_of(p_child) then raise exception 'not your child'; end if;
  if p_approve then
    update app.profiles set photo_url = coalesce(photo_pending_url, photo_url), photo_pending_url = null where id = p_child;
  else
    update app.profiles set photo_pending_url = null where id = p_child;
  end if;
end; $$;
grant execute on function app.guardian_approve_photo(uuid, boolean) to authenticated;
