create table if not exists public.fases (
  id integer primary key,
  nome text not null unique,
  ordem integer not null unique
);

insert into public.fases (id, nome, ordem)
values
  (1, 'Grupos', 1),
  (2, 'Oitavas', 2),
  (3, 'Quartas', 3),
  (4, 'Semifinal', 4),
  (5, 'Final', 5)
on conflict (id) do update
set
  nome = excluded.nome,
  ordem = excluded.ordem;

create table if not exists public.jogos (
  id uuid primary key default gen_random_uuid(),
  fase_id integer not null references public.fases(id),
  time1 text not null,
  time2 text not null,
  data timestamptz not null,
  gols1 integer,
  gols2 integer,
  encerrado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jogos_times_diferentes check (time1 <> time2),
  constraint jogos_gols1_nao_negativo check (gols1 is null or gols1 >= 0),
  constraint jogos_gols2_nao_negativo check (gols2 is null or gols2 >= 0),
  constraint jogos_placar_encerrado_completo check (
    not encerrado or (gols1 is not null and gols2 is not null)
  )
);

create index if not exists jogos_fase_id_idx on public.jogos (fase_id);
create index if not exists jogos_data_idx on public.jogos (data);

drop trigger if exists set_jogos_updated_at on public.jogos;

create trigger set_jogos_updated_at
before update on public.jogos
for each row
execute function public.set_updated_at();

create table if not exists public.palpites (
  user_id uuid not null references public.usuarios(id) on delete cascade,
  jogo_id uuid not null references public.jogos(id) on delete cascade,
  fase_id integer not null references public.fases(id),
  time1 text not null,
  time2 text not null,
  gols1 integer not null,
  gols2 integer not null,
  criado_em timestamptz not null default now(),
  primary key (user_id, jogo_id),
  constraint palpites_gols1_nao_negativo check (gols1 >= 0),
  constraint palpites_gols2_nao_negativo check (gols2 >= 0)
);

create index if not exists palpites_jogo_id_idx on public.palpites (jogo_id);
create index if not exists palpites_fase_id_idx on public.palpites (fase_id);

alter table public.fases enable row level security;
alter table public.jogos enable row level security;
alter table public.palpites enable row level security;

drop policy if exists "Fases podem ser lidas por todos" on public.fases;
create policy "Fases podem ser lidas por todos"
on public.fases
for select
to anon, authenticated
using (true);

drop policy if exists "Jogos podem ser lidos por todos" on public.jogos;
create policy "Jogos podem ser lidos por todos"
on public.jogos
for select
to anon, authenticated
using (true);

drop policy if exists "Usuarios podem ler os proprios palpites" on public.palpites;
create policy "Usuarios podem ler os proprios palpites"
on public.palpites
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Usuarios podem criar os proprios palpites" on public.palpites;
create policy "Usuarios podem criar os proprios palpites"
on public.palpites
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Usuarios podem atualizar os proprios palpites" on public.palpites;
create policy "Usuarios podem atualizar os proprios palpites"
on public.palpites
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
