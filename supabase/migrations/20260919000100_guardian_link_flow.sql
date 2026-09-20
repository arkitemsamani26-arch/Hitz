-- Guardian link lifecycle, request expiry, and the pieces the parent's magic link needs.

-- The link page records that the parent opened it. Callable before sign-in, by link id,
-- so the kid's screen can show "opened" the moment it happens. Returns nothing.
create or replace function app.mark_guardian_link_opened(p_link uuid)
returns void language sql security definer set search_path = app, public as $$
  update app.guardian_links set opened_at = coalesce(opened_at, now())
   where id = p_link and revoked_at is null;
$$;
grant execute on function app.mark_guardian_link_opened(uuid) to anon, authenticated;

-- What the link page shows before the parent signs in: the child's first name only.
create or replace function app.guardian_link_preview(p_link uuid)
returns table (child_name text, verified boolean)
language sql stable security definer set search_path = app, public as $$
  select p.display_name, g.verified_at is not null
    from app.guardian_links g join app.profiles p on p.id = g.minor_profile_id
   where g.id = p_link and g.revoked_at is null;
$$;
grant execute on function app.guardian_link_preview(uuid) to anon, authenticated;

-- The parent taps "Yes" after a magic-link sign-in. The signed-in user's email must
-- match the address the child entered; nothing else can verify a link.
create or replace function app.accept_guardian_link(p_link uuid)
returns void language plpgsql security definer set search_path = app, public, auth as $$
declare u_email text;
begin
  select lower(email) into u_email from auth.users where id = app.uid();
  if u_email is null then raise exception 'sign in first'; end if;
  update app.guardian_links
     set guardian_user_id = app.uid(), verified_at = coalesce(verified_at, now()), opened_at = coalesce(opened_at, now())
   where id = p_link and revoked_at is null and lower(guardian_email::text) = u_email;
  if not found then raise exception 'This link was sent to a different email address.'; end if;
end; $$;
grant execute on function app.accept_guardian_link(uuid) to authenticated;

-- "Pause or remove it any time." Revoking ends the child's participation immediately:
-- every open hit involving the child is cancelled.
create or replace function app.revoke_guardian_link(p_link uuid)
returns void language plpgsql security definer set search_path = app, public as $$
declare child uuid;
begin
  update app.guardian_links set revoked_at = now()
   where id = p_link and guardian_user_id = app.uid() and revoked_at is null
   returning minor_profile_id into child;
  if child is null then raise exception 'not your link'; end if;
  update app.hit_requests set state = 'cancelled', awaiting_profile_id = null
   where (from_profile_id = child or to_profile_id = child)
     and state in ('pending', 'countered', 'accepted', 'confirmed');
end; $$;
grant execute on function app.revoke_guardian_link(uuid) to authenticated;

-- Requests expire so the feed never fills with zombies. Run from the scheduled function.
create or replace function app.expire_requests()
returns int language plpgsql security definer set search_path = app, public as $$
declare n int;
begin
  update app.hit_requests set state = 'expired', awaiting_profile_id = null
   where state in ('pending', 'countered') and expires_at < now();
  get diagnostics n = row_count;
  return n;
end; $$;
