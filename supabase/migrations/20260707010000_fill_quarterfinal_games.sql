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
    '2515305',
    '97',
    'M97',
    4,
    'França',
    'Marrocos',
    '2026-07-09T20:00:00.000Z'::timestamptz,
    null,
    null,
    null,
    null,
    null,
    false,
    'upcoming'::public.jogo_placar_status,
    'NS',
    null
  ),
  (
    '2519345',
    '98',
    'M98',
    4,
    'Espanha',
    'Bélgica',
    '2026-07-10T19:00:00.000Z'::timestamptz,
    null,
    null,
    null,
    null,
    null,
    false,
    'upcoming'::public.jogo_placar_status,
    'NS',
    null
  ),
  (
    '2517651',
    '99',
    'M99',
    4,
    'Noruega',
    'Inglaterra',
    '2026-07-11T21:00:00.000Z'::timestamptz,
    null,
    null,
    null,
    null,
    null,
    false,
    'upcoming'::public.jogo_placar_status,
    'NS',
    null
  ),
  (
    null,
    '100',
    'M100',
    4,
    'Argentina',
    'Suíça',
    '2026-07-12T01:00:00.000Z'::timestamptz,
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
