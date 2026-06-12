create or replace function public.recalcular_ranking_completo()
returns table (
  jogos_recalculados integer,
  usuarios_atualizados integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  jogo record;
  jogos_count integer := 0;
  users_count integer := 0;
begin
  for jogo in
    select id
    from public.jogos
    where encerrado = true
    order by data asc
  loop
    select usuarios_atualizados
    into users_count
    from public.recalcular_pontuacao_jogo(jogo.id);

    jogos_count := jogos_count + 1;
  end loop;

  return query select jogos_count, users_count;
end;
$$;

grant execute on function public.recalcular_ranking_completo()
to anon, authenticated;
