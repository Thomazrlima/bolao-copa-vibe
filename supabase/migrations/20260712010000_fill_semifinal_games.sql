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
values
  (
    null,
    '101',
    'M101',
    5,
    'França',
    'Espanha',
    '2026-07-14T16:00:00.000Z'::timestamptz,
    null,
    null,
    null,
    null,
    null,
    false,
    'upcoming'::public.jogo_placar_status,
    null,
    null
  ),
  (
    null,
    '102',
    'M102',
    5,
    'Inglaterra',
    'Argentina',
    '2026-07-15T16:00:00.000Z'::timestamptz,
    null,
    null,
    null,
    null,
    null,
    false,
    'upcoming'::public.jogo_placar_status,
    null,
    null
  )
on conflict (codigo_mata_mata) where codigo_mata_mata is not null do update
set
  sportsdb_event_id = coalesce(excluded.sportsdb_event_id, public.jogos.sportsdb_event_id),
  worldcup2026_game_id = excluded.worldcup2026_game_id,
  fase_id = excluded.fase_id,
  time1 = excluded.time1,
  time2 = excluded.time2,
  data = excluded.data,
  placar_status = case
    when public.jogos.encerrado then public.jogos.placar_status
    else excluded.placar_status
  end,
  sportsdb_status = coalesce(excluded.sportsdb_status, public.jogos.sportsdb_status),
  sincronizado_em = case
    when public.jogos.sportsdb_event_id is distinct from excluded.sportsdb_event_id
      and excluded.sportsdb_event_id is not null
      then null
    else public.jogos.sincronizado_em
  end;
