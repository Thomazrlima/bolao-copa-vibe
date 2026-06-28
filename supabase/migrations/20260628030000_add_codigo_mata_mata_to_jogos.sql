alter table public.jogos
add column if not exists codigo_mata_mata text;

update public.jogos
set codigo_mata_mata = 'M' || worldcup2026_game_id
where fase_id > 1
  and worldcup2026_game_id ~ '^[0-9]+$'
  and codigo_mata_mata is null;

alter table public.jogos
drop constraint if exists jogos_codigo_mata_mata_formato;

alter table public.jogos
add constraint jogos_codigo_mata_mata_formato
check (codigo_mata_mata is null or codigo_mata_mata ~ '^M[0-9]+$');

create unique index if not exists jogos_codigo_mata_mata_key
on public.jogos (codigo_mata_mata)
where codigo_mata_mata is not null;
