drop policy if exists "Users can upload their own avatars" on storage.objects;
create policy "Users can upload their own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profiles'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can select their own avatars" on storage.objects;
create policy "Users can select their own avatars"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profiles'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profiles'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'profiles'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profiles'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
