insert into public.fases (id, nome, ordem)
values
  (6, 'Disputa de 3º', 6),
  (7, 'Final', 7)
on conflict (id) do update
set
  nome = excluded.nome,
  ordem = excluded.ordem;

with final_games (
  sportsdb_event_id,
  worldcup2026_game_id,
  codigo_mata_mata,
  fase_id,
  time1,
  time2,
  data_brasilia,
  placar_status,
  sportsdb_status
) as (
  values
    (
      '2533360',
      '103',
      'M103',
      6,
      'França',
      'Inglaterra',
      '2026-07-18T18:00:00.000Z'::timestamptz,
      'upcoming'::public.jogo_placar_status,
      'NS'
    ),
    (
      '2533361',
      '104',
      'M104',
      7,
      'Espanha',
      'Argentina',
      '2026-07-19T16:00:00.000Z'::timestamptz,
      'upcoming'::public.jogo_placar_status,
      'NS'
    )
),
updated_games as (
  update public.jogos j
  set
    sportsdb_event_id = coalesce(final_games.sportsdb_event_id, j.sportsdb_event_id),
    worldcup2026_game_id = final_games.worldcup2026_game_id,
    codigo_mata_mata = final_games.codigo_mata_mata,
    fase_id = final_games.fase_id,
    time1 = final_games.time1,
    time2 = final_games.time2,
    data = final_games.data_brasilia,
    placar_status = case
      when j.encerrado then j.placar_status
      when j.placar_status = 'finished'::public.jogo_placar_status then j.placar_status
      else final_games.placar_status
    end,
    sportsdb_status = case
      when j.encerrado then j.sportsdb_status
      else coalesce(final_games.sportsdb_status, j.sportsdb_status)
    end,
    sincronizado_em = case
      when j.sportsdb_event_id is distinct from final_games.sportsdb_event_id
        and final_games.sportsdb_event_id is not null
        then null
      else j.sincronizado_em
    end
  from final_games
  where j.codigo_mata_mata = final_games.codigo_mata_mata
    or j.worldcup2026_game_id = final_games.worldcup2026_game_id
  returning final_games.codigo_mata_mata
)
insert into public.jogos (
  sportsdb_event_id,
  worldcup2026_game_id,
  codigo_mata_mata,
  fase_id,
  time1,
  time2,
  data,
  gols1,
  gols2,
  penaltis1,
  penaltis2,
  vencedor,
  encerrado,
  placar_status,
  sportsdb_status,
  sincronizado_em
)
select
  final_games.sportsdb_event_id,
  final_games.worldcup2026_game_id,
  final_games.codigo_mata_mata,
  final_games.fase_id,
  final_games.time1,
  final_games.time2,
  final_games.data_brasilia,
  null,
  null,
  null,
  null,
  null,
  false,
  final_games.placar_status,
  final_games.sportsdb_status,
  null
from final_games
where not exists (
  select 1
  from public.jogos j
  where j.codigo_mata_mata = final_games.codigo_mata_mata
    or j.worldcup2026_game_id = final_games.worldcup2026_game_id
);
