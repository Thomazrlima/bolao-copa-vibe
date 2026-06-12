create table if not exists public.grupos (
  time text not null,
  grupo text not null,
  pontuacao integer not null default 0,
  saldo_gols integer not null default 0,
  gols_pro integer not null default 0,
  gols_contra integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint grupos_grupo_time_key unique (grupo, time)
);

drop trigger if exists set_grupos_updated_at on public.grupos;

create trigger set_grupos_updated_at
before update on public.grupos
for each row
execute function public.set_updated_at();

insert into public.grupos (grupo, time)
values
  ('A', 'México'),
  ('A', 'Coreia do Sul'),
  ('A', 'Tchéquia'),
  ('A', 'África do Sul'),
  ('B', 'Canadá'),
  ('B', 'Bósnia e Herzegovina'),
  ('B', 'Catar'),
  ('B', 'Suíça'),
  ('C', 'Brasil'),
  ('C', 'Marrocos'),
  ('C', 'Haiti'),
  ('C', 'Escócia'),
  ('D', 'Estados Unidos'),
  ('D', 'Paraguai'),
  ('D', 'Austrália'),
  ('D', 'Turquia'),
  ('E', 'Alemanha'),
  ('E', 'Curaçao'),
  ('E', 'Costa do Marfim'),
  ('E', 'Equador'),
  ('F', 'Países Baixos'),
  ('F', 'Japão'),
  ('F', 'Suécia'),
  ('F', 'Tunísia'),
  ('G', 'Bélgica'),
  ('G', 'Egito'),
  ('G', 'Irã'),
  ('G', 'Nova Zelândia'),
  ('H', 'Espanha'),
  ('H', 'Cabo Verde'),
  ('H', 'Arábia Saudita'),
  ('H', 'Uruguai'),
  ('I', 'França'),
  ('I', 'Senegal'),
  ('I', 'Iraque'),
  ('I', 'Noruega'),
  ('J', 'Argentina'),
  ('J', 'Argélia'),
  ('J', 'Áustria'),
  ('J', 'Jordânia'),
  ('K', 'Portugal'),
  ('K', 'RD Congo'),
  ('K', 'Uzbequistão'),
  ('K', 'Colômbia'),
  ('L', 'Inglaterra'),
  ('L', 'Croácia'),
  ('L', 'Gana'),
  ('L', 'Panamá')
on conflict (grupo, time) do nothing;

alter table public.grupos enable row level security;

drop policy if exists "Grupos podem ser lidos por todos" on public.grupos;
create policy "Grupos podem ser lidos por todos"
on public.grupos
for select
to anon, authenticated
using (true);

create or replace function public.recalcular_grupos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  with base as (
    select
      grupo,
      time,
      0::integer as pontuacao,
      0::integer as gols_pro,
      0::integer as gols_contra
    from public.grupos
  ),
  partidas as (
    select
      j.time1,
      j.time2,
      j.gols1,
      j.gols2,
      g1.grupo
    from public.jogos j
    join public.grupos g1 on g1.time = j.time1
    join public.grupos g2 on g2.time = j.time2 and g2.grupo = g1.grupo
    where j.encerrado
      and j.gols1 is not null
      and j.gols2 is not null
  ),
  linhas as (
    select
      grupo,
      time1 as time,
      case
        when gols1 > gols2 then 3
        when gols1 = gols2 then 1
        else 0
      end as pontuacao,
      gols1 as gols_pro,
      gols2 as gols_contra
    from partidas
    union all
    select
      grupo,
      time2 as time,
      case
        when gols2 > gols1 then 3
        when gols2 = gols1 then 1
        else 0
      end as pontuacao,
      gols2 as gols_pro,
      gols1 as gols_contra
    from partidas
  ),
  totals as (
    select
      base.grupo,
      base.time,
      coalesce(sum(linhas.pontuacao), 0)::integer as pontuacao,
      coalesce(sum(linhas.gols_pro), 0)::integer as gols_pro,
      coalesce(sum(linhas.gols_contra), 0)::integer as gols_contra
    from base
    left join linhas on linhas.grupo = base.grupo and linhas.time = base.time
    group by base.grupo, base.time
  )
  update public.grupos g
  set
    pontuacao = totals.pontuacao,
    gols_pro = totals.gols_pro,
    gols_contra = totals.gols_contra,
    saldo_gols = totals.gols_pro - totals.gols_contra
  from totals
  where g.grupo = totals.grupo
    and g.time = totals.time;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.recalcular_grupos()
to anon, authenticated;

create or replace function public.atualizar_placar_jogo_sportsdb(
  p_sportsdb_event_id text,
  p_gols1 integer,
  p_gols2 integer,
  p_encerrado boolean,
  p_status text default null
)
returns public.jogos
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_jogo public.jogos;
begin
  update public.jogos
  set
    gols1 = coalesce(p_gols1, gols1),
    gols2 = coalesce(p_gols2, gols2),
    encerrado = coalesce(p_encerrado, encerrado),
    sportsdb_status = p_status,
    sincronizado_em = now()
  where sportsdb_event_id = p_sportsdb_event_id
  returning * into updated_jogo;

  if updated_jogo.id is not null and updated_jogo.encerrado then
    if to_regprocedure('public.recalcular_pontuacao_jogo(uuid)') is not null then
      perform 1 from public.recalcular_pontuacao_jogo(updated_jogo.id);
    end if;

    perform public.recalcular_grupos();
  end if;

  return updated_jogo;
end;
$$;

grant execute on function public.atualizar_placar_jogo_sportsdb(text, integer, integer, boolean, text)
to anon, authenticated;
