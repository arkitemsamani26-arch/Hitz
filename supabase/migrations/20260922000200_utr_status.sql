-- Everything the app needs to know about a UTR link, and nothing it must never see.
--
-- app.utr_links has no client grants on purpose: it holds the OAuth tokens. But the app
-- has to know whether you are linked, what UTR says your rating is, and when we last
-- checked -- otherwise a linked player whose rating is still "projected" looks exactly
-- like someone who never linked, and gets asked to link forever.

create or replace function app.my_utr_status()
returns table (
  linked        boolean,
  utr_player_id text,
  rating        numeric,
  rating_status text,
  linked_at     timestamptz,
  synced_at     timestamptz
)
language sql
stable
security definer
set search_path = app, public
as $$
  select true, l.utr_player_id, l.rating, l.rating_status, l.linked_at, l.synced_at
    from app.utr_links l
   where l.profile_id = app.uid();
$$;

grant execute on function app.my_utr_status() to authenticated;

-- Unlinking is the player's own call, and it has to take the badge with it. A rating you
-- earned stays as your number; it just stops claiming to be verified.
create or replace function app.unlink_utr()
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if app.uid() is null then raise exception 'sign in first'; end if;
  delete from app.utr_links where profile_id = app.uid();
  update app.profiles
     set utr_player_id = null,
         utr_verified_at = null,
         level_source = case when level_source = 'utr_verified' then 'utr_self'::app.level_source else level_source end
   where id = app.uid();
end;
$$;

grant execute on function app.unlink_utr() to authenticated;

-- Re-sync ------------------------------------------------------------------------------
--
-- A verified badge that froze on the day it was issued is worse than no badge: UTR moves
-- every week. The utr-sync function reads this list, refreshes each token against UTR and
-- calls apply_utr. Service role only -- the refresh tokens are the whole point.
create or replace function app.utr_due_for_sync(p_limit int default 100)
returns table (profile_id uuid, utr_player_id text, refresh_token text)
language sql
stable
security definer
set search_path = app, public
as $$
  select l.profile_id, l.utr_player_id, l.refresh_token
    from app.utr_links l
   where l.refresh_token is not null
     and l.synced_at < now() - interval '24 hours'
   order by l.synced_at
   limit p_limit;
$$;

revoke execute on function app.utr_due_for_sync(int) from public, anon, authenticated;

-- When UTR says a link is gone, drop the badge rather than leaving a stale one standing.
create or replace function app.retire_utr(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  delete from app.utr_links where profile_id = p_profile;
  update app.profiles
     set utr_player_id = null, utr_verified_at = null,
         level_source = case when level_source = 'utr_verified' then 'utr_self'::app.level_source else level_source end
   where id = p_profile;
end;
$$;

revoke execute on function app.retire_utr(uuid) from public, anon, authenticated;
