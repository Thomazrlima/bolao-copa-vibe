-- Script de validacao: inserir/atualizar jogos das oitavas da Copa 2026.
-- NAO foi executado.
--
-- Fontes conferidas em 2026-07-04:
-- - Vencedores dos 16-avos: public.jogos, codigos M73 a M88.
-- - IDs/horarios de M89-M94: TheSportsDB eventsround.php?id=4429&r=16&s=2026.
-- - M95/M96 ainda nao apareceram no TheSportsDB porque M87 estava como live
--   no banco, apesar de ja ter vencedor = 'Colômbia'. Por isso ficam sem
--   sportsdb_event_id para preencher depois.
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
  penaltis1,
  penaltis2,
  vencedor,
  encerrado,
  placar_status,
  rodada,
  sportsdb_status,
  sincronizado_em
)
values
  -- M89 | Vencedor M73 x Vencedor M75 | TheSportsDB: Canada vs Morocco
  ('2505183', '89', 'M89', 3, 'Canadá', 'Marrocos', '2026-07-04T14:00:00.000Z'::timestamptz, null, null, null, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M90 | Vencedor M74 x Vencedor M77 | TheSportsDB: Paraguay vs France
  ('2505624', '90', 'M90', 3, 'Paraguai', 'França', '2026-07-04T18:00:00.000Z'::timestamptz, null, null, null, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M91 | Vencedor M76 x Vencedor M78 | TheSportsDB: Brazil vs Norway
  ('2505462', '91', 'M91', 3, 'Brasil', 'Noruega', '2026-07-05T17:00:00.000Z'::timestamptz, null, null, null, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M92 | Vencedor M79 x Vencedor M80 | TheSportsDB: Mexico vs England
  ('2507706', '92', 'M92', 3, 'México', 'Inglaterra', '2026-07-05T21:00:00.000Z'::timestamptz, null, null, null, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M93 | Vencedor M83 x Vencedor M84 | TheSportsDB: Portugal vs Spain
  ('2511721', '93', 'M93', 3, 'Portugal', 'Espanha', '2026-07-06T16:00:00.000Z'::timestamptz, null, null, null, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M94 | Vencedor M81 x Vencedor M82 | TheSportsDB: USA vs Belgium
  ('2507707', '94', 'M94', 3, 'Estados Unidos', 'Bélgica', '2026-07-06T21:00:00.000Z'::timestamptz, null, null, null, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M95 | Vencedor M86 x Vencedor M88 | TheSportsDB ainda nao retornou evento: Argentina vs Egypt
  (null, '95', 'M95', 3, 'Argentina', 'Egito', '2026-07-07T13:00:00.000Z'::timestamptz, null, null, null, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now()),
  -- M96 | Vencedor M85 x Vencedor M87 | M87 estava live no banco; conferir antes de executar: Switzerland vs Colombia
  (null, '96', 'M96', 3, 'Suíça', 'Colômbia', '2026-07-07T17:00:00.000Z'::timestamptz, null, null, null, null, null, false, 'upcoming'::public.jogo_placar_status, null, 'NS', now())
on conflict (worldcup2026_game_id) do update
set
  sportsdb_event_id = coalesce(excluded.sportsdb_event_id, public.jogos.sportsdb_event_id),
  codigo_mata_mata = excluded.codigo_mata_mata,
  fase_id = excluded.fase_id,
  time1 = excluded.time1,
  time2 = excluded.time2,
  data = excluded.data,
  gols1 = coalesce(public.jogos.gols1, excluded.gols1),
  gols2 = coalesce(public.jogos.gols2, excluded.gols2),
  penaltis1 = coalesce(public.jogos.penaltis1, excluded.penaltis1),
  penaltis2 = coalesce(public.jogos.penaltis2, excluded.penaltis2),
  vencedor = coalesce(public.jogos.vencedor, excluded.vencedor),
  encerrado = public.jogos.encerrado or excluded.encerrado,
  placar_status = case
    when public.jogos.placar_status = 'live'::public.jogo_placar_status then public.jogos.placar_status
    when public.jogos.encerrado then public.jogos.placar_status
    else excluded.placar_status
  end,
  rodada = excluded.rodada,
  sportsdb_status = coalesce(excluded.sportsdb_status, public.jogos.sportsdb_status),
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
where worldcup2026_game_id ~ '^[0-9]+$'
  and worldcup2026_game_id::integer between 89 and 96
order by worldcup2026_game_id::integer;

commit;
