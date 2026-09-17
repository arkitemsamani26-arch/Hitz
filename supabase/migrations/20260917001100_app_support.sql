-- Small additions the app layer needs.

-- A decline carries a reason. It is the anti-ghosting mechanism: a "no" with a reason is
-- a real reply, and the product treats it as one.
alter table app.hit_requests add column decline_reason text;

-- Phone verification is established by the OTP sign-in itself; this stamps it onto the
-- profile from the auth record rather than trusting the client to say so.
create or replace function app.stamp_phone_verified()
returns void
language plpgsql security definer set search_path = app, public, auth
as $$
begin
  update app.profiles p
     set phone_verified_at = coalesce(p.phone_verified_at, u.phone_confirmed_at, now())
    from auth.users u
   where p.id = app.uid() and u.id = p.id and u.phone is not null;
end;
$$;
grant execute on function app.stamp_phone_verified() to authenticated;
