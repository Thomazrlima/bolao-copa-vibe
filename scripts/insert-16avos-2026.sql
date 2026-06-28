-- Script de validacao: inserir/atualizar jogos dos 16-avos da Copa 2026.
-- NAO foi executado.
--
-- Observacao sobre `data`:
-- o projeto importa `strTimestamp` UTC do TheSportsDB subtraindo 3h,
-- guardando o horario de Brasilia em coluna timestamptz. Este script segue
-- a mesma convencao usada por scripts/import-fase-grupos.mjs.

begin;

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
  encerrado,
  placar_status,
  rodada,
  sportsdb_status,
  sincronizado_em
)
values
  -- M74 | 1o Grupo E x 3o Grupo D | TheSportsDB: Germany vs Paraguay
  ('2502846', '74', 'M74', 2, 'Alemanha', 'Paraguai', '2026-06-29T17:30:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M75 | 1o Grupo F x 2o Grupo C | TheSportsDB: Netherlands vs Morocco
  ('2499836', '75', 'M75', 2, 'Países Baixos', 'Marrocos', '2026-06-29T22:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M76 | 1o Grupo C x 2o Grupo F | TheSportsDB: Brazil vs Japan
  ('2499835', '76', 'M76', 2, 'Brasil', 'Japão', '2026-06-29T14:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M77 | 1o Grupo I x 3o Grupo F | TheSportsDB: France vs Sweden
  ('2502847', '77', 'M77', 2, 'França', 'Suécia', '2026-06-30T18:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M78 | 2o Grupo E x 2o Grupo I | TheSportsDB: Ivory Coast vs Norway
  ('2502605', '78', 'M78', 2, 'Costa do Marfim', 'Noruega', '2026-06-30T14:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M79 | 1o Grupo A x 3o Grupo E | TheSportsDB: Mexico vs Ecuador
  ('2503390', '79', 'M79', 2, 'México', 'Equador', '2026-06-30T22:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M80 | 1o Grupo L x 3o Grupo K | TheSportsDB: England vs DR Congo
  ('2503391', '80', 'M80', 2, 'Inglaterra', 'RD Congo', '2026-07-01T13:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M81 | 1o Grupo D x 3o Grupo B | TheSportsDB: USA vs Bosnia-Herzegovina
  ('2499837', '81', 'M81', 2, 'Estados Unidos', 'Bósnia e Herzegovina', '2026-07-01T21:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M82 | 1o Grupo G x 3o Grupo I | TheSportsDB: Belgium vs Senegal
  ('2503392', '82', 'M82', 2, 'Bélgica', 'Senegal', '2026-07-01T17:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M83 | 2o Grupo K x 2o Grupo L | TheSportsDB: Portugal vs Croatia
  ('2503393', '83', 'M83', 2, 'Portugal', 'Croácia', '2026-07-02T20:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M84 | 1o Grupo H x 2o Grupo J | TheSportsDB: Spain vs Austria
  ('2503636', '84', 'M84', 2, 'Espanha', 'Áustria', '2026-07-02T16:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M85 | 1o Grupo B x 3o Grupo J | TheSportsDB: Switzerland vs Algeria
  ('2503635', '85', 'M85', 2, 'Suíça', 'Argélia', '2026-07-03T00:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M86 | 1o Grupo J x 2o Grupo H | TheSportsDB: Argentina vs Cape Verde
  ('2502849', '86', 'M86', 2, 'Argentina', 'Cabo Verde', '2026-07-03T19:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M87 | 1o Grupo K x 3o Grupo L | TheSportsDB: Colombia vs Ghana
  ('2503394', '87', 'M87', 2, 'Colômbia', 'Gana', '2026-07-03T22:30:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M88 | 2o Grupo D x 2o Grupo G | TheSportsDB: Australia vs Egypt
  ('2502848', '88', 'M88', 2, 'Austrália', 'Egito', '2026-07-03T15:00:00.000Z'::timestamptz, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now())
on conflict (worldcup2026_game_id) do update
set
  sportsdb_event_id = excluded.sportsdb_event_id,
  codigo_mata_mata = excluded.codigo_mata_mata,
  fase_id = excluded.fase_id,
  time1 = excluded.time1,
  time2 = excluded.time2,
  data = excluded.data,
  gols1 = coalesce(public.jogos.gols1, excluded.gols1),
  gols2 = coalesce(public.jogos.gols2, excluded.gols2),
  encerrado = public.jogos.encerrado or excluded.encerrado,
  placar_status = case
    when public.jogos.placar_status = 'live'::public.jogo_placar_status then public.jogos.placar_status
    when public.jogos.encerrado then public.jogos.placar_status
    else excluded.placar_status
  end,
  rodada = excluded.rodada,
  sportsdb_status = excluded.sportsdb_status,
  sincronizado_em = now();

select
  worldcup2026_game_id,
  codigo_mata_mata,
  sportsdb_event_id,
  fase_id,
  time1,
  time2,
  data,
  placar_status,
  sportsdb_status
from public.jogos
where worldcup2026_game_id between '73' and '88'
order by worldcup2026_game_id::integer;

commit;
