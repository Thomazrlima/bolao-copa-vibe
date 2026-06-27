create or replace function public.multiplicador_pontos_fase(p_fase_id integer)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case p_fase_id
    when 2 then 1.2
    when 3 then 1.4
    when 4 then 1.6
    when 5 then 1.8
    when 7 then 2.0
    else 1.0
  end;
$$;

revoke execute on function public.multiplicador_pontos_fase(integer)
from public, anon, authenticated;

create or replace function public.calcular_pontos_placar(
  p_palpite_gols1 integer,
  p_palpite_gols2 integer,
  p_placar_gols1 integer,
  p_placar_gols2 integer,
  p_fase_id integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  with base as (
    select case
      when p_placar_gols1 is null or p_placar_gols2 is null then 0
      when p_palpite_gols1 = p_placar_gols1
        and p_palpite_gols2 = p_placar_gols2 then 10
      when sign(p_palpite_gols1 - p_palpite_gols2) = sign(p_placar_gols1 - p_placar_gols2)
        and (
          p_palpite_gols1 = p_placar_gols1
          or p_palpite_gols2 = p_placar_gols2
          or abs(p_palpite_gols1 - p_palpite_gols2)
            = abs(p_placar_gols1 - p_placar_gols2)
        ) then 7
      when sign(p_palpite_gols1 - p_palpite_gols2)
        = sign(p_placar_gols1 - p_placar_gols2) then 5
      when p_palpite_gols1 = p_placar_gols1
        or p_palpite_gols2 = p_placar_gols2 then 2
      else 0
    end as pontos
  )
  select floor(base.pontos * public.multiplicador_pontos_fase(p_fase_id))::integer
  from base;
$$;

revoke execute on function public.calcular_pontos_placar(integer, integer, integer, integer, integer)
from public, anon, authenticated;

create or replace function public.calcular_pontos_placar(
  p_palpite_gols1 integer,
  p_palpite_gols2 integer,
  p_placar_gols1 integer,
  p_placar_gols2 integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select public.calcular_pontos_placar(
    p_palpite_gols1,
    p_palpite_gols2,
    p_placar_gols1,
    p_placar_gols2,
    1
  );
$$;

revoke execute on function public.calcular_pontos_placar(integer, integer, integer, integer)
from public, anon, authenticated;

create or replace function public.recalcular_pontuacao_jogo(p_jogo_id uuid)
returns table (
  palpites_calculados integer,
  usuarios_atualizados integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  calculated_count integer := 0;
  updated_users_count integer := 0;
begin
  update public.palpites p
  set
    pontos = case
      when not j.encerrado or j.gols1 is null or j.gols2 is null then 0
      else public.calcular_pontos_placar(p.gols1, p.gols2, j.gols1, j.gols2, j.fase_id)
    end,
    chinelada = j.encerrado
      and j.gols1 is not null
      and j.gols2 is not null
      and p.gols1 = j.gols1
      and p.gols2 = j.gols2,
    calculado_em = now()
  from public.jogos j
  where j.id = p_jogo_id
    and p.jogo_id = j.id;

  get diagnostics calculated_count = row_count;

  with totals as (
    select
      u.id,
      (
        coalesce(sum(p.pontos), 0)
        + public.pontos_especiais_usuario(u.id)
      )::integer as pontos,
      coalesce(count(*) filter (where p.chinelada), 0)::integer as chineladas
    from public.usuarios u
    left join public.palpites p on p.user_id = u.id
    group by u.id
  )
  update public.usuarios u
  set
    pontos = totals.pontos,
    chineladas = totals.chineladas
  from totals
  where u.id = totals.id;

  get diagnostics updated_users_count = row_count;

  return query select calculated_count, updated_users_count;
end;
$$;

revoke execute on function public.recalcular_pontuacao_jogo(uuid)
from public, anon, authenticated;
grant execute on function public.recalcular_pontuacao_jogo(uuid) to service_role;

create or replace function public.obter_ranking_ao_vivo()
returns table (
  id uuid,
  nome_completo text,
  pontos integer,
  pontos_oficiais integer,
  chineladas integer,
  chineladas_oficiais integer,
  posicao integer,
  posicao_base integer,
  variacao integer,
  movimento text
)
language sql
stable
security definer
set search_path = public
as $$
  with current_window as (
    select rj.id, rj.status
    from public.ranking_janelas rj
    order by
      case when rj.status = 'live' then 0 else 1 end,
      coalesce(rj.finalizada_em, rj.iniciada_em) desc
    limit 1
  ),
  live_points as (
    select
      p.user_id,
      coalesce(
        sum(
          public.calcular_pontos_placar(p.gols1, p.gols2, j.gols1, j.gols2, j.fase_id)
        ),
        0
      )::integer as pontos,
      count(*) filter (
        where j.gols1 is not null
          and j.gols2 is not null
          and p.gols1 = j.gols1
          and p.gols2 = j.gols2
      )::integer as chineladas
    from current_window cw
    join public.ranking_janela_jogos rjj on rjj.janela_id = cw.id
    join public.jogos j on j.id = rjj.jogo_id
    join public.palpites p on p.jogo_id = j.id
    where cw.status = 'live'
      and not j.encerrado
      and j.placar_status = 'live'
    group by p.user_id
  ),
  projected as (
    select
      u.id,
      u.nome_completo,
      (
        u.pontos
        + case when cw.status = 'live' then coalesce(lp.pontos, 0) else 0 end
      )::integer as pontos,
      u.pontos::integer as pontos_oficiais,
      (
        u.chineladas
        + case when cw.status = 'live' then coalesce(lp.chineladas, 0) else 0 end
      )::integer as chineladas,
      u.chineladas::integer as chineladas_oficiais,
      rjp.posicao_base,
      cw.status
    from public.usuarios u
    left join current_window cw on true
    left join live_points lp on lp.user_id = u.id
    left join public.ranking_janela_posicoes rjp
      on rjp.janela_id = cw.id
     and rjp.user_id = u.id
  ),
  ranked as (
    select
      projected.*,
      row_number() over (
        order by pontos desc, chineladas desc, nome_completo asc
      )::integer as posicao
    from projected
  )
  select
    ranked.id,
    ranked.nome_completo,
    ranked.pontos,
    ranked.pontos_oficiais,
    ranked.chineladas,
    ranked.chineladas_oficiais,
    ranked.posicao,
    coalesce(ranked.posicao_base, ranked.posicao)::integer as posicao_base,
    (
      coalesce(ranked.posicao_base, ranked.posicao) - ranked.posicao
    )::integer as variacao,
    case
      when ranked.posicao_base is null then null
      when ranked.status = 'live' then 'partial'
      when ranked.status = 'finished' then 'final'
      else null
    end as movimento
  from ranked
  order by ranked.posicao;
$$;

revoke execute on function public.obter_ranking_ao_vivo() from public;
grant execute on function public.obter_ranking_ao_vivo() to anon, authenticated;

do $$
begin
  if to_regprocedure('public.recalcular_ranking_completo()') is not null then
    perform 1 from public.recalcular_ranking_completo();
  end if;
end;
$$;
