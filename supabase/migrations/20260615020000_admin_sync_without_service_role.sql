create or replace function public.admin_sync_execucoes_bolao()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.usuario_e_admin_bolao() then
    raise exception 'Sem permissao para acessar o historico do sincronizador.';
  end if;

  return coalesce(
    (
      select jsonb_agg(to_jsonb(execution) order by execution.iniciado_em desc)
      from (
        select
          id,
          iniciado_em,
          finalizado_em,
          sucesso,
          erro,
          duracao_ms,
          resumo,
          diagnosticos
        from public.sync_jogos_execucoes
        order by iniciado_em desc
        limit 20
      ) execution
    ),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function public.admin_sync_execucoes_bolao() from public, anon;
grant execute on function public.admin_sync_execucoes_bolao() to authenticated;
