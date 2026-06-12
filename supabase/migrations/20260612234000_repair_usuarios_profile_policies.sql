alter table public.usuarios enable row level security;

drop policy if exists "Usuarios podem ler o proprio perfil" on public.usuarios;
create policy "Usuarios podem ler o proprio perfil"
on public.usuarios
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Usuarios podem atualizar o proprio perfil" on public.usuarios;
create policy "Usuarios podem atualizar o proprio perfil"
on public.usuarios
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  avatar_path text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select on table public.profiles to anon;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "Authenticated users can view profiles" on public.profiles;
drop policy if exists "Profiles can be viewed publicly" on public.profiles;
create policy "Profiles can be viewed publicly"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "Users can view profiles" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
