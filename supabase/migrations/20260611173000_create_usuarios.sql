create extension if not exists citext with schema public;

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email public.citext not null unique,
  nome_completo text not null,
  telefone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.usuarios enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_usuarios_updated_at on public.usuarios;

create trigger set_usuarios_updated_at
before update on public.usuarios
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, email, nome_completo, telefone)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nome_completo', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(nullif(new.raw_user_meta_data ->> 'telefone', ''), '')
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

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
