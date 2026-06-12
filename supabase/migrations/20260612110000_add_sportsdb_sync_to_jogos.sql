alter table public.jogos
add column if not exists sportsdb_event_id text,
add column if not exists sportsdb_status text,
add column if not exists sincronizado_em timestamptz;

drop index if exists public.jogos_sportsdb_event_id_key;

alter table public.jogos
drop constraint if exists jogos_sportsdb_event_id_key,
add constraint jogos_sportsdb_event_id_key unique (sportsdb_event_id);

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
  updated_jogo public.jogos;
begin
  update public.jogos
  set
    gols1 = coalesce(p_gols1, gols1),
    gols2 = coalesce(p_gols2, gols2),
    encerrado = coalesce(p_encerrado, encerrado),
    sportsdb_status = p_status,
    sincronizado_em = now()
  where sportsdb_event_id = p_sportsdb_event_id
  returning * into updated_jogo;

  return updated_jogo;
end;
$$;

grant execute on function public.atualizar_placar_jogo_sportsdb(text, integer, integer, boolean, text)
to anon, authenticated;
