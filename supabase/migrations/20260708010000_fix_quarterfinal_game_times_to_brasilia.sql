-- Corrige somente os jogos de quartas inseridos pela migration
-- 20260707010000_fill_quarterfinal_games.sql.
--
-- Exemplo: 2026-07-09 20:00:00+00 passa a ser 2026-07-09 17:00:00+00.
update public.jogos
set data = (data at time zone 'America/Sao_Paulo') at time zone 'UTC'
where codigo_mata_mata in ('M97', 'M98', 'M99', 'M100');
