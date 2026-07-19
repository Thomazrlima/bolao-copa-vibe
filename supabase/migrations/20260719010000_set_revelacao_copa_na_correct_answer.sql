delete from public.palpites_especiais_respostas_corretas
where pergunta_id = 'revelacao-copa';

insert into public.palpites_especiais_respostas_corretas (
  pergunta_id,
  resposta
)
values (
  'revelacao-copa',
  'N/A'
)
on conflict (pergunta_id, resposta) do nothing;

do $$
begin
  if to_regprocedure('public.recalcular_totais_usuarios()') is not null then
    perform public.recalcular_totais_usuarios();
  elsif to_regprocedure('public.recalcular_ranking_completo()') is not null then
    perform 1 from public.recalcular_ranking_completo();
  end if;
end $$;

notify pgrst, 'reload schema';
