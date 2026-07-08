create or replace function public.multiplicador_pontos_fase(p_fase_id integer)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case p_fase_id
    when 2 then 1.2
    when 3 then 1.4
    when 4 then 2.0
    when 5 then 3.0
    when 7 then 4.0
    else 1.0
  end;
$$;

revoke execute on function public.multiplicador_pontos_fase(integer)
from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.recalcular_ranking_completo()') is not null then
    perform 1 from public.recalcular_ranking_completo();
  end if;
end $$;

notify pgrst, 'reload schema';
