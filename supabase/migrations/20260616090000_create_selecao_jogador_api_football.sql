create table if not exists public.selecao (
  codigo text primary key,
  nome text not null,
  api_football_team_id integer unique,
  api_football_team_name text,
  api_football_logo_url text,
  jogadores_sincronizados_em timestamptz,
  erro_sync text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists selecao_nome_idx on public.selecao (nome);
create index if not exists selecao_api_football_team_id_idx
on public.selecao (api_football_team_id);
create index if not exists selecao_jogadores_sincronizados_em_idx
on public.selecao (jogadores_sincronizados_em);

drop trigger if exists set_selecao_updated_at on public.selecao;

create trigger set_selecao_updated_at
before update on public.selecao
for each row
execute function public.set_updated_at();

create table if not exists public.jogador (
  id uuid primary key default gen_random_uuid(),
  selecao_codigo text not null references public.selecao(codigo) on delete cascade,
  api_football_player_id integer not null,
  nome text not null,
  idade integer,
  numero integer,
  posicao text,
  foto_url text,
  sincronizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jogador_idade_valida check (idade is null or idade >= 0),
  constraint jogador_numero_valido check (numero is null or numero >= 0),
  constraint jogador_api_football_unique unique (selecao_codigo, api_football_player_id)
);

create index if not exists jogador_selecao_codigo_idx on public.jogador (selecao_codigo);
create index if not exists jogador_nome_idx on public.jogador (nome);
create index if not exists jogador_posicao_idx on public.jogador (posicao);

drop trigger if exists set_jogador_updated_at on public.jogador;

create trigger set_jogador_updated_at
before update on public.jogador
for each row
execute function public.set_updated_at();

alter table public.selecao enable row level security;
alter table public.jogador enable row level security;

drop policy if exists "Selecoes podem ser lidas por todos" on public.selecao;
create policy "Selecoes podem ser lidas por todos"
on public.selecao
for select
to anon, authenticated
using (true);

drop policy if exists "Jogadores podem ser lidos por todos" on public.jogador;
create policy "Jogadores podem ser lidos por todos"
on public.jogador
for select
to anon, authenticated
using (true);

grant select on public.selecao to anon, authenticated;
grant select on public.jogador to anon, authenticated;
grant insert, update, delete on public.selecao to authenticated;
grant insert, update, delete on public.jogador to authenticated;
grant all on public.selecao to service_role;
grant all on public.jogador to service_role;

drop policy if exists "Admins podem criar selecoes" on public.selecao;
create policy "Admins podem criar selecoes"
on public.selecao
for insert
to authenticated
with check (public.usuario_e_admin_bolao());

drop policy if exists "Admins podem atualizar selecoes" on public.selecao;
create policy "Admins podem atualizar selecoes"
on public.selecao
for update
to authenticated
using (public.usuario_e_admin_bolao())
with check (public.usuario_e_admin_bolao());

drop policy if exists "Admins podem apagar selecoes" on public.selecao;
create policy "Admins podem apagar selecoes"
on public.selecao
for delete
to authenticated
using (public.usuario_e_admin_bolao());

drop policy if exists "Admins podem criar jogadores" on public.jogador;
create policy "Admins podem criar jogadores"
on public.jogador
for insert
to authenticated
with check (public.usuario_e_admin_bolao());

drop policy if exists "Admins podem atualizar jogadores" on public.jogador;
create policy "Admins podem atualizar jogadores"
on public.jogador
for update
to authenticated
using (public.usuario_e_admin_bolao())
with check (public.usuario_e_admin_bolao());

drop policy if exists "Admins podem apagar jogadores" on public.jogador;
create policy "Admins podem apagar jogadores"
on public.jogador
for delete
to authenticated
using (public.usuario_e_admin_bolao());

grant insert, update on public.sync_jogos_execucoes to authenticated;

drop policy if exists "Admins podem criar execucoes de sync" on public.sync_jogos_execucoes;
create policy "Admins podem criar execucoes de sync"
on public.sync_jogos_execucoes
for insert
to authenticated
with check (public.usuario_e_admin_bolao());

drop policy if exists "Admins podem atualizar execucoes de sync" on public.sync_jogos_execucoes;
create policy "Admins podem atualizar execucoes de sync"
on public.sync_jogos_execucoes
for update
to authenticated
using (public.usuario_e_admin_bolao())
with check (public.usuario_e_admin_bolao());

comment on table public.selecao is
'Cache das seleções usadas pelo bolão com identificadores da API-Football.';

comment on table public.jogador is
'Jogadores sincronizados da API-Football por seleção.';

comment on column public.jogador.foto_url is
'URL da foto do jogador retornada pela API-Football.';
