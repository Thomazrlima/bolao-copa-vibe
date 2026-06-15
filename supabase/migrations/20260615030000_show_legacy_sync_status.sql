create or replace function public.admin_sync_execucoes_bolao()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  executions jsonb;
begin
  if not public.usuario_e_admin_bolao() then
    raise exception 'Sem permissao para acessar o historico do sincronizador.';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(execution) order by execution.iniciado_em desc),
    '[]'::jsonb
  )
  into executions
  from (
    select
      id,
      iniciado_em,
      finalizado_em,
      sucesso,
      erro,
      duracao_ms,
      resumo,
      diagnosticos,
      false as legado
    from public.sync_jogos_execucoes
    order by iniciado_em desc
    limit 20
  ) execution;

  if jsonb_array_length(executions) = 0 then
    select jsonb_build_array(
      jsonb_build_object(
        'id', 'legacy-sync-state',
        'iniciado_em', s.ultima_tentativa,
        'finalizado_em', coalesce(s.ultimo_sucesso, s.ultima_tentativa),
        'sucesso', s.ultimo_erro is null and s.ultimo_sucesso is not null,
        'erro', s.ultimo_erro,
        'duracao_ms', s.duracao_ms,
        'resumo', jsonb_build_object(
          'jogos_elegiveis', s.jogos_elegiveis,
          'jogos_sincronizados', s.jogos_sincronizados
        ),
        'diagnosticos', '[]'::jsonb,
        'legado', true
      )
    )
    into executions
    from public.sync_jogos_estado s
    where s.id = true
      and s.ultima_tentativa is not null;
  end if;

  return coalesce(executions, '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_sync_execucoes_bolao() from public, anon;
grant execute on function public.admin_sync_execucoes_bolao() to authenticated;
