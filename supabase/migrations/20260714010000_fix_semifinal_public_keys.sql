-- Corrige as chaves públicas/sportsdb das semifinais sem recriar jogos.
--
-- Importante: esta migration usa apenas UPDATE em public.jogos.
-- Assim o id do jogo é preservado e os palpites existentes continuam
-- apontando para os mesmos registros.
--
-- IDs conferidos na TheSportsDB:
-- M101: France vs Spain     -> 2528031, ao vivo em 2026-07-14
-- M102: England vs Argentina -> 2528727
--
-- A coluna data segue a convenção atual do app: horário de Brasília
-- armazenado como wall-clock em timestamptz +00.
with semifinal_games (
  codigo_mata_mata,
  worldcup2026_game_id,
  sportsdb_event_id,
  time1,
  time2,
  data_brasilia,
  placar_status,
  sportsdb_status
) as (
  values
    (
      'M101',
      '101',
      '2528031',
      'França',
      'Espanha',
      '2026-07-14T16:00:00.000Z'::timestamptz,
      'live'::public.jogo_placar_status,
      '1H'
    ),
    (
      'M102',
      '102',
      '2528727',
      'Inglaterra',
      'Argentina',
      '2026-07-15T16:00:00.000Z'::timestamptz,
      'upcoming'::public.jogo_placar_status,
      'NS'
    )
)
update public.jogos j
set
  sportsdb_event_id = semifinal_games.sportsdb_event_id,
  worldcup2026_game_id = semifinal_games.worldcup2026_game_id,
  codigo_mata_mata = semifinal_games.codigo_mata_mata,
  fase_id = 5,
  time1 = semifinal_games.time1,
  time2 = semifinal_games.time2,
  data = semifinal_games.data_brasilia,
  placar_status = case
    when j.encerrado then j.placar_status
    when j.placar_status = 'finished'::public.jogo_placar_status then j.placar_status
    else semifinal_games.placar_status
  end,
  sportsdb_status = case
    when j.encerrado then j.sportsdb_status
    else semifinal_games.sportsdb_status
  end,
  sincronizado_em = null
from semifinal_games
where j.codigo_mata_mata = semifinal_games.codigo_mata_mata
  or (
    j.codigo_mata_mata is null
    and j.worldcup2026_game_id = semifinal_games.worldcup2026_game_id
  );
