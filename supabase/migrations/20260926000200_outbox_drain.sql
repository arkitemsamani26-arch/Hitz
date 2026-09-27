-- Draining the outbox, without the key living anywhere it can leak
--
-- `notify` has existed for a week and has never run. It needs the service_role key to be
-- invoked, the key does not belong in a migration, a repository or an environment file, and
-- so the outbox has simply filled up. That is the worst kind of broken: a fourteen-year-old
-- whose parent approved their hit is never told, and nothing anywhere goes red.
--
-- The fix is to put the key in Supabase Vault -- encrypted, not readable through the API,
-- never in git -- and have a scheduled function read it from there. Nobody has to paste a
-- key into anything that gets committed, and this file is safe to publish.
--
-- Until the secret exists this returns 'no key' every minute and changes nothing. That is
-- deliberate: a job that fails loudly on a project without the secret is a job somebody
-- disables, and then it is off on the project that does have it.
create or replace function app.drain_outbox()
returns text
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_key     text;
  v_base    text;
  v_waiting int;
begin
  select count(*) into v_waiting from app.notifications where sent_at is null;
  if v_waiting = 0 then return 'idle'; end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key';
  if v_key is null or v_key = '' then return 'no key'; end if;

  -- The project's functions URL. Overridable by a second secret so a branch or a restored
  -- project does not keep calling the original one's edge function.
  select decrypted_secret into v_base
    from vault.decrypted_secrets where name = 'functions_base_url';
  v_base := coalesce(nullif(v_base, ''), 'https://pvkzcbgpbebllnzmxxwg.supabase.co/functions/v1');

  -- pg_net is asynchronous: this queues the request and returns. Outcomes land in
  -- net._http_response, which is where to look when push is silent.
  perform net.http_post(
    url     := v_base || '/notify',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000);

  return 'called ' || v_waiting;
end;
$$;

revoke execute on function app.drain_outbox() from public, anon, authenticated;
grant  execute on function app.drain_outbox() to service_role;

comment on function app.drain_outbox() is
  'Invokes the notify edge function using the service_role key from Vault. '
  'Returns ''no key'' and does nothing until the secret named service_role_key exists.';
