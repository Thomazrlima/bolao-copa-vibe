alter table public.jogos
add column if not exists estatisticas jsonb,
add column if not exists estatisticas_sincronizadas_em timestamptz;

comment on column public.jogos.estatisticas is
'Estatísticas comparativas retornadas pelo endpoint lookupeventstats.php do TheSportsDB.';
