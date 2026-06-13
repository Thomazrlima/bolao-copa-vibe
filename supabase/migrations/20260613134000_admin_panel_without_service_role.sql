create or replace function public.admin_overview_bolao()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.usuario_e_admin_bolao() then
    raise exception 'Sem permissao para acessar a administracao.';
  end if;

  return jsonb_build_object(
    'users',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', u.id,
              'nome_completo', u.nome_completo,
              'email', u.email
            )
            order by u.nome_completo
          )
          from public.usuarios u
        ),
        '[]'::jsonb
      ),
    'games',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', j.id,
              'fase_id', j.fase_id,
              'time1', j.time1,
              'time2', j.time2,
              'data', j.data,
              'encerrado', j.encerrado,
              'transmissao_url', j.transmissao_url
            )
            order by j.data
          )
          from public.jogos j
        ),
        '[]'::jsonb
      ),
    'highlights',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'slot', td.slot,
              'jogo_id', td.jogo_id
            )
            order by td.slot
          )
          from public.transmissao_destaques td
        ),
        '[]'::jsonb
      ),
    'sync_status',
      (
        select to_jsonb(s)
        from public.sync_jogos_estado s
        where s.id = true
      ),
    'guesses',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'user_id', p.user_id,
              'jogo_id', p.jogo_id
            )
          )
          from public.palpites p
        ),
        '[]'::jsonb
      )
  );
end;
$$;

revoke execute on function public.admin_overview_bolao() from public, anon;
grant execute on function public.admin_overview_bolao() to authenticated;

create or replace function public.salvar_transmissoes_admin(p_highlights jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
  if not public.usuario_e_admin_bolao() then
    raise exception 'Sem permissao para editar transmissoes.';
  end if;

  for item in
    select *
    from jsonb_to_recordset(p_highlights) as x(slot integer, jogo_id uuid, url text)
  loop
    update public.jogos
    set transmissao_url = item.url
    where id = item.jogo_id;

    if not found then
      raise exception 'Jogo selecionado nao existe.';
    end if;

    insert into public.transmissao_destaques (slot, jogo_id, updated_at)
    values (item.slot, item.jogo_id, now())
    on conflict (slot)
    do update set
      jogo_id = excluded.jogo_id,
      updated_at = excluded.updated_at;
  end loop;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'slot', td.slot,
          'jogo_id', td.jogo_id,
          'url', j.transmissao_url
        )
        order by td.slot
      )
      from public.transmissao_destaques td
      join public.jogos j on j.id = td.jogo_id
      where td.slot in (1, 2)
    ),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function public.salvar_transmissoes_admin(jsonb) from public, anon;
grant execute on function public.salvar_transmissoes_admin(jsonb) to authenticated;
