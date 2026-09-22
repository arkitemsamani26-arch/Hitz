-- Personal invite codes. The table has existed since the foundation with nothing on top
-- of it, so the density mechanism docs/06 leans on was never actually in the product.
--
-- Rosters cover a captain handing one code to a whole team. This covers the other half
-- and the more common one: one player bringing one friend. Same rule as rosters and
-- clubs -- an invite carries NO visibility privilege. Redeeming one does not let anybody
-- see anybody. It records who brought whom, which is the only way to read where a market's
-- density actually came from, and it gives the new player a name to arrive to.

-- One code space, two kinds of code ----------------------------------------------------
--
-- Both kinds are typed into the same field, so they must not collide. The generator is
-- the only thing that mints either, and it checks both tables. It also fixes a real bug
-- in create_roster: that loop gave up after 20 tries and inserted the duplicate anyway,
-- surfacing as a raw unique violation on a name whose short code space had filled.
create or replace function app.mint_code(p_len int default 8, p_seed text default null)
returns text
language plpgsql
security definer
set search_path = app, public
as $$
declare
  -- No I, O, 0 or 1: these get read aloud and typed by a fourteen-year-old.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_stem text;
  i int;
  tries int := 0;
begin
  -- A name too short to stem (or written in another script) has no usable seed.
  v_stem := substr(upper(regexp_replace(coalesce(p_seed, ''), '[^A-Za-z]', '', 'g')), 1, 5);
  if length(v_stem) < 3 then v_stem := null; end if;
  loop
    if v_stem is not null then
      -- Speakable: a team says this one out loud at practice.
      v_code := v_stem || lpad((floor(random() * 90) + 10)::int::text, 2, '0');
    else
      -- Texted, not spoken, so it can afford the entropy: 32^8 is not worth guessing at,
      -- which matters because check_code tells an unauthenticated caller a first name.
      v_code := '';
      for i in 1..greatest(p_len, 6) loop
        v_code := v_code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
      end loop;
    end if;
    exit when not exists (select 1 from app.rosters r where r.code = v_code)
          and not exists (select 1 from app.invites x where x.code = v_code);
    tries := tries + 1;
    -- A seeded space is small and can genuinely fill up. Stop insisting on the name.
    if tries > 25 then v_stem := null; end if;
    if tries > 60 then raise exception 'could not mint a code'; end if;
  end loop;
  return v_code;
end;
$$;

revoke execute on function app.mint_code(int, text) from public, anon, authenticated;

-- Issuing --------------------------------------------------------------------------------
--
-- Ten open at a time. Not a growth lever to be pulled until it breaks: an invite is a
-- personal vouch, and a thousand of them from one account is a different object.
create or replace function app.issue_invite()
returns app.invites
language plpgsql
security definer
set search_path = app, public
as $$
declare v app.invites; me app.profiles;
begin
  select * into me from app.profiles where id = app.uid();
  if me.id is null or not app.is_participating(me.id) then raise exception 'not participating'; end if;
  if (select count(*) from app.invites i
       where i.issued_by_profile_id = me.id
         and i.redeemed_at is null
         and (i.expires_at is null or i.expires_at > now())) >= 10 then
    raise exception 'You have ten invites out already. Wait for one to be used.';
  end if;
  insert into app.invites (code, issued_by_profile_id, market_id, intended_band, roster_id, expires_at)
  values (app.mint_code(8), me.id, me.market_id,
          (case when me.adult_at > current_date then 'minor' else 'adult' end)::app.age_band,
          me.roster_id,
          now() + interval '30 days')
  returning * into v;
  return v;
end;
$$;

grant execute on function app.issue_invite() to authenticated;

-- Checking, before anyone has signed in ----------------------------------------------------
--
-- Runs at the phone step, so anon. It returns the issuer's first name, which is the whole
-- point of the moment ("Maya invited you") and is why invite codes carry real entropy:
-- the only way to see a name here is to have been handed the code.
--
-- A full team and a used invite both come back valid = false WITH the label, so the field
-- can say "that team is full" rather than pretending the code does not exist.
create or replace function app.check_code(p_code text)
returns table (valid boolean, kind text, label text)
language sql
stable
security definer
set search_path = app, public
as $$
  select (count(p.id) < r.cap), 'roster'::text, r.name::text
    from app.rosters r
    left join app.profiles p on p.roster_id = r.id
   where r.code = p_code
   group by r.id, r.cap, r.name
  union all
  select (i.redeemed_at is null and (i.expires_at is null or i.expires_at > now())),
         'invite'::text, pr.display_name::text
    from app.invites i
    join app.profiles pr on pr.id = i.issued_by_profile_id
   where i.code = p_code;
$$;

grant execute on function app.check_code(text) to anon, authenticated;

-- Redeeming --------------------------------------------------------------------------------
--
-- Runs once, straight after the profile insert, because both kinds of code write a column
-- on a row that has to exist first.
create or replace function app.redeem_code(p_code text)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
declare v_rid uuid; v_inv app.invites;
begin
  if app.uid() is null then raise exception 'not signed in'; end if;

  -- A team code first: it is the one with a cap to check.
  select r.id into v_rid
    from app.rosters r
   where r.code = p_code
     and (select count(*) from app.profiles p where p.roster_id = r.id) < r.cap;
  if v_rid is not null then
    update app.profiles set roster_id = v_rid where id = app.uid() and roster_id is null;
    return;
  end if;

  -- One invite per player, ever. Attribution is a fact about how someone arrived.
  if exists (select 1 from app.invites i where i.redeemed_by_profile_id = app.uid()) then
    raise exception 'You have already used an invite.';
  end if;

  select * into v_inv
    from app.invites i
   where i.code = p_code
     and i.redeemed_at is null
     and (i.expires_at is null or i.expires_at > now())
     for update;
  if v_inv.code is null then raise exception 'That code is full, used or unknown.'; end if;
  if v_inv.issued_by_profile_id = app.uid() then raise exception 'That is your own invite.'; end if;

  update app.invites
     set redeemed_by_profile_id = app.uid(), redeemed_at = now()
   where code = v_inv.code and redeemed_at is null;
  if not found then raise exception 'That invite was just used.'; end if;

  -- An invite issued by someone on a roster carries the roster with it, so a player
  -- bringing a teammate does not have to hand over two codes.
  if v_inv.roster_id is not null then
    update app.profiles set roster_id = v_inv.roster_id where id = app.uid() and roster_id is null;
  end if;

  -- The issuer hears that it landed. Not who: the two of them may be in different bands,
  -- and a redemption is not a reason to name anybody to anybody.
  perform app.enqueue(v_inv.issued_by_profile_id, 'invite_redeemed', 'Your invite landed',
    'Someone you invited just joined Hits.', jsonb_build_object('code', v_inv.code::text));
end;
$$;

grant execute on function app.redeem_code(text) to authenticated;

-- Route roster minting through the shared generator, so the two code spaces stay disjoint
-- and a popular team name cannot collide its way into a unique violation.
create or replace function app.create_roster(p_name text, p_cap int default 20)
returns app.rosters
language plpgsql
security definer
set search_path = app, public
as $$
declare r app.rosters;
begin
  if not app.is_participating(app.uid()) then raise exception 'not participating'; end if;
  insert into app.rosters (name, code, cap, market_id, created_by)
  select p_name, app.mint_code(8, p_name), p_cap, p.market_id, p.id
    from app.profiles p where p.id = app.uid()
  returning * into r;
  return r;
end;
$$;

grant execute on function app.create_roster(text, int) to authenticated;

-- Where a market's density actually came from. Service-role only, alongside the rest of
-- the reviewer's reading in supabase/moderation.sql.
create or replace view app.invite_funnel as
  select coalesce(ro.name, 'personal invite') as source,
         count(*) filter (where i.redeemed_at is not null)                       as joined,
         count(*) filter (where i.redeemed_at is null
                            and (i.expires_at is null or i.expires_at > now()))  as outstanding,
         count(*) filter (where i.redeemed_at is null and i.expires_at <= now()) as expired,
         min(i.created_at)                                                       as first_issued
    from app.invites i
    left join app.rosters ro on ro.id = i.roster_id
   group by coalesce(ro.name, 'personal invite')
   order by 2 desc;

revoke all on app.invite_funnel from public, anon, authenticated;
