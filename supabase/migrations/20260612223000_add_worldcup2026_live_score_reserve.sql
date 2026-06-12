do $$
begin
  create type public.jogo_placar_status as enum ('upcoming', 'live', 'finished');
exception
  when duplicate_object then null;
end $$;

alter table public.jogos
add column if not exists worldcup2026_game_id text,
add column if not exists placar_status public.jogo_placar_status not null default 'upcoming';

alter table public.jogos
drop constraint if exists jogos_worldcup2026_game_id_key;

alter table public.jogos
add constraint jogos_worldcup2026_game_id_key unique (worldcup2026_game_id);

with ordered_group_games as (
  select
    id,
    row_number() over (order by data, sportsdb_event_id) as worldcup2026_id
  from public.jogos
  where fase_id = 1
)
update public.jogos j
set worldcup2026_game_id = ordered_group_games.worldcup2026_id::text
from ordered_group_games
where
  j.id = ordered_group_games.id
  and j.worldcup2026_game_id is null
  and ordered_group_games.worldcup2026_id between 1 and 72;

update public.jogos
set placar_status = case
  when encerrado then 'finished'::public.jogo_placar_status
  when data <= now() then 'live'::public.jogo_placar_status
  else 'upcoming'::public.jogo_placar_status
end;

create or replace function public.atualizar_placar_jogo_worldcup2026(
  p_worldcup2026_game_id text,
  p_gols1 integer,
  p_gols2 integer,
  p_placar_status text,
  p_status_origem text default null
)
returns public.jogos
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status public.jogo_placar_status;
  updated_jogo public.jogos;
begin
  normalized_status := case lower(coalesce(p_placar_status, 'upcoming'))
    when 'finished' then 'finished'::public.jogo_placar_status
    when 'live' then 'live'::public.jogo_placar_status
    else 'upcoming'::public.jogo_placar_status
  end;

  update public.jogos
  set
    gols1 = case
      when normalized_status = 'upcoming' then gols1
      else coalesce(p_gols1, gols1)
    end,
    gols2 = case
      when normalized_status = 'upcoming' then gols2
      else coalesce(p_gols2, gols2)
    end,
    encerrado = encerrado or normalized_status = 'finished',
    placar_status = normalized_status,
    sportsdb_status = p_status_origem,
    sincronizado_em = now()
  where worldcup2026_game_id = p_worldcup2026_game_id
  returning * into updated_jogo;

  if updated_jogo.id is not null and updated_jogo.encerrado then
    if to_regprocedure('public.recalcular_pontuacao_jogo(uuid)') is not null then
      perform 1 from public.recalcular_pontuacao_jogo(updated_jogo.id);
    end if;

    if to_regprocedure('public.recalcular_grupos()') is not null then
      perform public.recalcular_grupos();
    end if;
  end if;

  return updated_jogo;
end;
$$;

grant execute on function public.atualizar_placar_jogo_worldcup2026(text, integer, integer, text, text)
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
  normalized_status public.jogo_placar_status;
  updated_jogo public.jogos;
begin
  normalized_status := case
    when coalesce(p_encerrado, false) then 'finished'::public.jogo_placar_status
    when p_status is null then null
    when lower(trim(p_status)) in ('ft', 'aet', 'pen', 'match finished', 'finished', 'full time') then 'finished'::public.jogo_placar_status
    when lower(trim(p_status)) in ('notstarted', 'not started', 'scheduled', 'ns', '') then 'upcoming'::public.jogo_placar_status
    else 'live'::public.jogo_placar_status
  end;

  update public.jogos
  set
    gols1 = coalesce(p_gols1, gols1),
    gols2 = coalesce(p_gols2, gols2),
    encerrado = encerrado or coalesce(p_encerrado, false) or normalized_status = 'finished',
    placar_status = coalesce(normalized_status, placar_status),
    sportsdb_status = p_status,
    sincronizado_em = now()
  where sportsdb_event_id = p_sportsdb_event_id
  returning * into updated_jogo;

  if updated_jogo.id is not null and updated_jogo.encerrado then
    if to_regprocedure('public.recalcular_pontuacao_jogo(uuid)') is not null then
      perform 1 from public.recalcular_pontuacao_jogo(updated_jogo.id);
    end if;

    if to_regprocedure('public.recalcular_grupos()') is not null then
      perform public.recalcular_grupos();
    end if;
  end if;

  return updated_jogo;
end;
$$;

grant execute on function public.atualizar_placar_jogo_sportsdb(text, integer, integer, boolean, text)
to anon, authenticated;
