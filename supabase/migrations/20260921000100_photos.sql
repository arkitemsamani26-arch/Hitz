-- Profile photos. Stored in a public-read bucket under random names; the profile row
-- carries the URL, so who can SEE a photo is exactly who can see the profile (RLS on
-- profiles): an adult cannot enumerate a minor's row, so cannot find the URL. A linked
-- parent can remove their child's photo.
do $storage$ begin
  if to_regclass('storage.buckets') is null then return; end if;   -- local test DB has no storage
  execute $q$insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing$q$;
  execute $q$create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$q$;
  execute $q$create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$q$;
  execute $q$create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$q$;
  execute $q$create policy avatars_read_all on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');$q$;
end $storage$;

create or replace function app.guardian_remove_photo(p_child uuid)
returns void language plpgsql security definer set search_path = app, public as $$
begin
  if not app.is_guardian_of(p_child) then raise exception 'not your child'; end if;
  update app.profiles set photo_url = null where id = p_child;
end; $$;
grant execute on function app.guardian_remove_photo(uuid) to authenticated;
