create or replace function public.recalcular_totais_apos_gabarito_especial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regprocedure('public.recalcular_totais_usuarios()') is not null then
    perform public.recalcular_totais_usuarios();
  elsif to_regprocedure('public.recalcular_ranking_completo()') is not null then
    perform 1 from public.recalcular_ranking_completo();
  end if;

  insert into public.realtime_atualizacoes (canal, versao, atualizado_em)
  values ('ranking', 1, now())
  on conflict (canal) do update
  set
    versao = public.realtime_atualizacoes.versao + 1,
    atualizado_em = excluded.atualizado_em;

  return null;
end;
$$;

revoke execute on function public.recalcular_totais_apos_gabarito_especial()
from public, anon, authenticated;

drop trigger if exists recalcular_totais_apos_gabarito_especial
on public.palpites_especiais_respostas_corretas;

create trigger recalcular_totais_apos_gabarito_especial
after insert or update or delete on public.palpites_especiais_respostas_corretas
for each statement
execute function public.recalcular_totais_apos_gabarito_especial();

do $$
begin
  if to_regprocedure('public.recalcular_totais_usuarios()') is not null then
    perform public.recalcular_totais_usuarios();
  end if;
end;
$$;

notify pgrst, 'reload schema';
