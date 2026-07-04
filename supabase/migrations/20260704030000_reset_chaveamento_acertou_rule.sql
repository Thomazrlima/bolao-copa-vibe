drop function if exists public.recalcular_pontuacao_chaveamento();

create or replace function public.recalcular_totais_usuarios()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_users_count integer := 0;
begin
  with totals as (
    select
      u.id,
      (
        coalesce(sum(p.pontos), 0)
        + public.pontos_especiais_usuario(u.id)
        + public.pontos_chaveamento_usuario(u.id)
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

  return updated_users_count;
end;
$$;

revoke execute on function public.recalcular_totais_usuarios()
from public, anon, authenticated;

grant execute on function public.recalcular_totais_usuarios()
to service_role;

create or replace function public.recalcular_pontuacao_chaveamento(p_fase_id integer default null)
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
  reset_count integer := 0;
  updated_users_count integer := 0;
begin
  with scoring_games as (
    select
      fase_id,
      least(time1, time2) as time_a,
      greatest(time1, time2) as time_b,
      encerrado
    from public.jogos
    where fase_id >= 3
      and fase_id <> 6
      and (p_fase_id is null or fase_id = p_fase_id)
      and time1 is not null
      and time2 is not null
  ),
  official_pairs as (
    select distinct
      fase_id,
      time_a,
      time_b
    from scoring_games
  ),
  eliminated_teams as (
    select
      j.fase_id,
      case
        when j.vencedor = j.time1 then j.time2
        when j.vencedor = j.time2 then j.time1
        else null
      end as time
    from public.jogos j
    where j.fase_id >= 2
      and j.fase_id <> 6
      and j.encerrado
      and j.vencedor in (j.time1, j.time2)
  ),
  avaliados as (
    select
      pc.user_id,
      pc.fase_id,
      pc.slot,
      exists (
        select 1
        from official_pairs fp
        where fp.fase_id = pc.fase_id
          and fp.time_a = least(pc.time1, pc.time2)
          and fp.time_b = greatest(pc.time1, pc.time2)
      ) as acertou,
      exists (
        select 1
        from eliminated_teams et
        where et.time in (pc.time1, pc.time2)
      ) as eliminou_time
    from public.palpites_chaveamento pc
    where pc.fase_id >= 3
      and pc.fase_id <> 6
      and (p_fase_id is null or pc.fase_id = p_fase_id)
  )
  update public.palpites_chaveamento pc
  set
    acertou = case
      when avaliados.acertou then true
      when avaliados.eliminou_time then false
      else null
    end,
    pontos = case when avaliados.acertou then 5 else 0 end,
    calculado_em = case
      when avaliados.acertou or avaliados.eliminou_time then now()
      else null
    end
  from avaliados
  where pc.user_id = avaliados.user_id
    and pc.fase_id = avaliados.fase_id
    and pc.slot = avaliados.slot;

  get diagnostics calculated_count = row_count;

  update public.palpites_chaveamento pc
  set
    acertou = null,
    pontos = 0,
    calculado_em = null
  where (
      p_fase_id is null
      and (pc.fase_id < 3 or pc.fase_id = 6)
    )
    or (
      p_fase_id is not null
      and pc.fase_id = p_fase_id
      and (pc.fase_id < 3 or pc.fase_id = 6)
    );

  get diagnostics reset_count = row_count;

  updated_users_count := public.recalcular_totais_usuarios();

  return query select calculated_count + reset_count, updated_users_count;
end;
$$;

revoke execute on function public.recalcular_pontuacao_chaveamento(integer)
from public, anon;

grant execute on function public.recalcular_pontuacao_chaveamento(integer)
to service_role;

create or replace function public.recalcular_pontuacao_chaveamento_admin(p_fase_id integer)
returns table (
  palpites_calculados integer,
  usuarios_atualizados integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.usuario_e_admin_bolao() then
    raise exception 'Acesso negado para recalcular a pontuacao do mata-mata.';
  end if;

  if p_fase_id not in (3, 4, 5, 7) then
    raise exception 'Fase invalida para recalcular a pontuacao do mata-mata.';
  end if;

  return query
  select *
  from public.recalcular_pontuacao_chaveamento(p_fase_id);
end;
$$;

revoke execute on function public.recalcular_pontuacao_chaveamento_admin(integer)
from public, anon, authenticated;

grant execute on function public.recalcular_pontuacao_chaveamento_admin(integer)
to authenticated, service_role;

update public.palpites_chaveamento
set
  acertou = null,
  pontos = 0,
  calculado_em = null;

do $$
begin
  if to_regprocedure('public.recalcular_totais_usuarios()') is not null then
    perform public.recalcular_totais_usuarios();
  end if;
end;
$$;

notify pgrst, 'reload schema';
