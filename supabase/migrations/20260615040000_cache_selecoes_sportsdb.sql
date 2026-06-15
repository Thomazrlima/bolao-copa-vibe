create table if not exists public.selecoes_sportsdb (
  codigo text primary key,
  nome text not null,
  sportsdb_team_id text not null unique,
  sportsdb_team_name text,
  jogadores jsonb not null default '[]'::jsonb,
  sincronizado_em timestamptz,
  erro_sync text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists selecoes_sportsdb_nome_idx on public.selecoes_sportsdb (nome);
create index if not exists selecoes_sportsdb_sincronizado_em_idx
on public.selecoes_sportsdb (sincronizado_em);

drop trigger if exists set_selecoes_sportsdb_updated_at on public.selecoes_sportsdb;

create trigger set_selecoes_sportsdb_updated_at
before update on public.selecoes_sportsdb
for each row
execute function public.set_updated_at();

alter table public.selecoes_sportsdb enable row level security;

drop policy if exists "Selecoes SportsDB podem ser lidas por todos" on public.selecoes_sportsdb;
create policy "Selecoes SportsDB podem ser lidas por todos"
on public.selecoes_sportsdb
for select
to anon, authenticated
using (true);

comment on table public.selecoes_sportsdb is
'Cache de identificadores e jogadores das seleções no TheSportsDB para evitar chamadas externas no perfil público.';

comment on column public.selecoes_sportsdb.jogadores is
'Lista normalizada de jogadores retornados por lookup_all_players.php.';
