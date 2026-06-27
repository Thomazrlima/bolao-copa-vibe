create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_app_config_updated_at on public.app_config;
create trigger set_app_config_updated_at
before update on public.app_config
for each row
execute function public.set_updated_at();

alter table public.app_config enable row level security;

insert into public.app_config (key, value)
values ('palpites_chaveamento_visible', 'true'::jsonb)
on conflict (key) do nothing;

drop policy if exists "Todos podem ler configuracoes publicas" on public.app_config;
create policy "Todos podem ler configuracoes publicas"
on public.app_config
for select
to anon, authenticated
using (key in ('palpites_chaveamento_visible'));

drop policy if exists "Admins podem criar configuracoes" on public.app_config;
create policy "Admins podem criar configuracoes"
on public.app_config
for insert
to authenticated
with check (public.usuario_e_admin_bolao());

drop policy if exists "Admins podem atualizar configuracoes" on public.app_config;
create policy "Admins podem atualizar configuracoes"
on public.app_config
for update
to authenticated
using (public.usuario_e_admin_bolao())
with check (public.usuario_e_admin_bolao());

grant select on public.app_config to anon, authenticated;
grant insert, update on public.app_config to authenticated;
