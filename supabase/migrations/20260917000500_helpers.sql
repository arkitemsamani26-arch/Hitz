-- Safety predicates.
--
-- Every one of these is SECURITY DEFINER so it can be called from an RLS policy on the
-- same table it reads without recursing (the owner bypasses RLS). They are the only
-- place the safety rules are written down; policies compose them rather than restating
-- them, so a future feature inherits the rules instead of having to remember them.

create or replace function app.uid()
returns uuid language sql stable as $$ select auth.uid() $$;

-- Derived from date of birth against today. Never stored as a client-writable field.
create or replace function app.band_of(dob date)
returns app.age_band
language sql
stable
as $$
  select case when (dob + interval '18 years')::date <= current_date
              then 'adult'::app.age_band
              else 'minor'::app.age_band
         end;
$$;

create or replace function app.profile_band(p_profile uuid)
returns app.age_band
language sql
stable
security definer
set search_path = app, public
as $$
  select case when adult_at <= current_date then 'adult'::app.age_band
              else 'minor'::app.age_band end
    from app.profiles where id = p_profile;
$$;

-- A minor participates only once a guardian link is verified and not revoked.
create or replace function app.has_verified_guardian(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.guardian_links g
     where g.minor_profile_id = p_profile
       and g.verified_at is not null
       and g.revoked_at is null
       and g.guardian_user_id is not null
  );
$$;

create or replace function app.is_guardian_of(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.guardian_links g
     where g.minor_profile_id = p_profile
       and g.guardian_user_id = app.uid()
       and g.verified_at is not null
       and g.revoked_at is null
  );
$$;

-- "Can this profile take part in the product at all?"
--   - active status
--   - phone verified (the cheapest real barrier to fake accounts, required of everyone)
--   - if a minor: a verified guardian link
create or replace function app.is_participating(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.profiles p
     where p.id = p_profile
       and p.status = 'active'
       and p.phone_verified_at is not null
       and (p.adult_at <= current_date or app.has_verified_guardian(p.id))
  );
$$;

create or replace function app.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.blocks
     where (blocker_id = a and blocked_id = b)
        or (blocker_id = b and blocked_id = a)
  );
$$;

-- THE SEPARATION RULE.
--
-- v1 ships strict: minors and adults do not appear to each other in discovery and cannot
-- initiate contact across the boundary. Ruled in deliberately, with the liquidity cost
-- accepted (see docs/06-seeding-strategy.md).
--
-- The value of this predicate is that it is UNCONDITIONAL: there is no setting, no club
-- affiliation and no per-request approval that can widen it in v1. A conditional
-- invariant is where the bug would eventually be. Relaxing it later is a deliberate
-- change to this one function, with tests that will loudly fail -- which is exactly the
-- friction such a change should have.
create or replace function app.same_band(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select app.profile_band(a) = app.profile_band(b);
$$;

-- Composed rule for "may the current user see this profile at all".
create or replace function app.can_view_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select
    app.uid() is not null
    and target is not null
    and app.is_participating(target)
    and app.is_participating(app.uid())
    and app.same_band(app.uid(), target)
    and not app.blocked_between(app.uid(), target);
$$;

-- Sending a request requires everything viewing requires. Kept as its own function
-- because the two will diverge (rate limits, market checks) and callers should not have
-- to know which rule they need.
create or replace function app.can_request_hit(from_profile uuid, to_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select
    from_profile = app.uid()
    and from_profile <> to_profile
    and app.is_participating(from_profile)
    and app.is_participating(to_profile)
    and app.same_band(from_profile, to_profile)
    and not app.blocked_between(from_profile, to_profile);
$$;

-- Live density per cohort, so "is the pool thick enough to open discovery?" is a number
-- rather than a feeling. Adult signups can never open the junior cohort.
create or replace view app.market_cohort_density as
  select
    m.id   as market_id,
    m.slug as market_slug,
    c.age_band,
    c.min_active_players,
    c.discovery_open,
    count(p.id) filter (
      where p.status = 'active'
        and p.phone_verified_at is not null
        and p.last_active_at > now() - interval '30 days'
    ) as active_players
  from app.markets m
  join app.market_cohorts c on c.market_id = m.id
  left join app.profiles p
    on p.market_id = m.id
   and (case when p.adult_at <= current_date then 'adult' else 'minor' end)::app.age_band = c.age_band
  group by m.id, m.slug, c.age_band, c.min_active_players, c.discovery_open;

create or replace function app.cohort_discovery_open(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select coalesce(c.discovery_open, false)
    from app.profiles p
    join app.market_cohorts c
      on c.market_id = p.market_id
     and c.age_band = app.profile_band(p.id)
   where p.id = p_profile;
$$;
