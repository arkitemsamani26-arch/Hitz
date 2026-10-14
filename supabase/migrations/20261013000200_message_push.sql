-- A message reaches the other player as a push (migration 20261013000200).
--
-- Messages had no notification at all: you found out someone wrote when you next opened
-- the app. Now the other player gets "Kenji: Running 5 minutes late". If a push for the
-- same thread is still waiting to go out, it is updated rather than stacked, so a burst of
-- five quick lines arrives as one notification carrying the latest.
create or replace function app.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare h record; who text; other uuid; pending uuid;
begin
  select from_profile_id, to_profile_id into h from app.hit_requests where id = new.hit_request_id;
  other := case when new.sender_profile_id = h.from_profile_id then h.to_profile_id else h.from_profile_id end;
  select display_name into who from app.profiles where id = new.sender_profile_id;
  if other is null or who is null then return null; end if;

  select n.id into pending from app.notifications n
   where n.user_id = other and n.kind = 'message' and n.sent_at is null
     and (n.data->>'hit')::uuid = new.hit_request_id
   order by n.created_at desc limit 1;
  if pending is not null then
    update app.notifications set body = left(new.body, 140), created_at = now() where id = pending;
  else
    perform app.enqueue(other, 'message', who, left(new.body, 140),
      jsonb_build_object('hit', new.hit_request_id, 'chat', true));
  end if;
  return null;
end;
$$;

create trigger hit_messages_notify
  after insert on app.hit_messages
  for each row execute function app.notify_on_message();

revoke execute on function app.notify_on_message() from public, anon, authenticated;
