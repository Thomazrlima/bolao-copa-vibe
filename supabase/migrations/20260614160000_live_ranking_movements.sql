create table if not exists public.ranking_janelas (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'live',
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  constraint ranking_janelas_status_valido check (status in ('live', 'finished')),
  constraint ranking_janelas_finalizacao_valida check (
    (status = 'live' and finalizada_em is null)
    or (status = 'finished' and finalizada_em is not null)
  )
);

create unique index if not exists ranking_janelas_apenas_uma_ativa_idx
on public.ranking_janelas ((status))
where status = 'live';

create table if not exists public.ranking_janela_jogos (
  janela_id uuid not null references public.ranking_janelas(id) on delete cascade,
  jogo_id uuid not null references public.jogos(id) on delete cascade,
  primary key (janela_id, jogo_id),
  unique (jogo_id)
);

create table if not exists public.ranking_janela_posicoes (
  janela_id uuid not null references public.ranking_janelas(id) on delete cascade,
  user_id uuid not null references public.usuarios(id) on delete cascade,
  posicao_base integer not null,
  pontos_base integer not null,
  chineladas_base integer not null,
  posicao_final integer,
  pontos_finais integer,
  chineladas_finais integer,
  primary key (janela_id, user_id),
  constraint ranking_janela_posicao_base_positiva check (posicao_base > 0),
  constraint ranking_janela_posicao_final_positiva check (
    posicao_final is null or posicao_final > 0
  )
);

alter table public.ranking_janelas enable row level security;
alter table public.ranking_janela_jogos enable row level security;
alter table public.ranking_janela_posicoes enable row level security;

revoke all on public.ranking_janelas from public, anon, authenticated;
revoke all on public.ranking_janela_jogos from public, anon, authenticated;
revoke all on public.ranking_janela_posicoes from public, anon, authenticated;

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
  end;
$$;

revoke execute on function public.calcular_pontos_placar(integer, integer, integer, integer)
from public, anon, authenticated;

create or replace function public.preparar_ranking_janela(p_jogo_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  active_window_id uuid;
begin
  select id
  into active_window_id
  from public.ranking_janelas
  where status = 'live'
  order by iniciada_em desc
  limit 1
  for update;

  if active_window_id is null then
    insert into public.ranking_janelas (status)
    values ('live')
    returning id into active_window_id;

    insert into public.ranking_janela_posicoes (
      janela_id,
      user_id,
      posicao_base,
      pontos_base,
      chineladas_base
    )
    select
      active_window_id,
      ranked.id,
      ranked.posicao,
      ranked.pontos,
      ranked.chineladas
    from (
      select
        u.id,
        u.pontos,
        u.chineladas,
        row_number() over (
          order by u.pontos desc, u.chineladas desc, u.nome_completo asc
        )::integer as posicao
      from public.usuarios u
    ) ranked;
  end if;

  insert into public.ranking_janela_jogos (janela_id, jogo_id)
  values (active_window_id, p_jogo_id)
  on conflict (jogo_id) do nothing;

  return active_window_id;
end;
$$;

revoke execute on function public.preparar_ranking_janela(uuid)
from public, anon, authenticated;
grant execute on function public.preparar_ranking_janela(uuid) to service_role;

create or replace function public.finalizar_ranking_janela_se_pronta(p_janela_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  has_open_games boolean;
begin
  select exists (
    select 1
    from public.ranking_janela_jogos rjj
    join public.jogos j on j.id = rjj.jogo_id
    where rjj.janela_id = p_janela_id
      and not j.encerrado
  )
  into has_open_games;

  if has_open_games then
    return false;
  end if;

  with final_ranking as (
    select
      u.id,
      u.pontos,
      u.chineladas,
      row_number() over (
        order by u.pontos desc, u.chineladas desc, u.nome_completo asc
      )::integer as posicao
    from public.usuarios u
  )
  update public.ranking_janela_posicoes rjp
  set
    posicao_final = final_ranking.posicao,
    pontos_finais = final_ranking.pontos,
    chineladas_finais = final_ranking.chineladas
  from final_ranking
  where rjp.janela_id = p_janela_id
    and rjp.user_id = final_ranking.id;

  update public.ranking_janelas
  set
    status = 'finished',
    finalizada_em = now()
  where id = p_janela_id
    and status = 'live';

  return found;
end;
$$;

revoke execute on function public.finalizar_ranking_janela_se_pronta(uuid)
from public, anon, authenticated;
grant execute on function public.finalizar_ranking_janela_se_pronta(uuid) to service_role;

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
          public.calcular_pontos_placar(p.gols1, p.gols2, j.gols1, j.gols2)
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

create or replace function public.sinalizar_ranking_por_placar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if
    old.gols1 is distinct from new.gols1
    or old.gols2 is distinct from new.gols2
    or old.placar_status is distinct from new.placar_status
    or old.encerrado is distinct from new.encerrado
  then
    insert into public.realtime_atualizacoes (canal, versao, atualizado_em)
    values ('ranking', 1, now())
    on conflict (canal) do update
    set
      versao = public.realtime_atualizacoes.versao + 1,
      atualizado_em = excluded.atualizado_em;
  end if;

  return null;
end;
$$;

revoke execute on function public.sinalizar_ranking_por_placar()
from public, anon, authenticated;

drop trigger if exists sinalizar_ranking_por_placar on public.jogos;
create trigger sinalizar_ranking_por_placar
after update on public.jogos
for each row
execute function public.sinalizar_ranking_por_placar();

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
  normalized_status public.jogo_placar_status;
  current_jogo public.jogos;
  updated_jogo public.jogos;
  active_window_id uuid;
begin
  normalized_status := case
    when coalesce(p_encerrado, false) then 'finished'::public.jogo_placar_status
    when p_status is null then null
    when lower(trim(p_status)) in (
      'ft', 'aet', 'pen', 'match finished', 'finished', 'full time'
    ) then 'finished'::public.jogo_placar_status
    when lower(trim(p_status)) in (
      'notstarted', 'not started', 'scheduled', 'ns', ''
    ) then 'upcoming'::public.jogo_placar_status
    else 'live'::public.jogo_placar_status
  end;

  select *
  into current_jogo
  from public.jogos
  where sportsdb_event_id = p_sportsdb_event_id
  for update;

  if current_jogo.id is null then
    return null;
  end if;

  if not current_jogo.encerrado
    and normalized_status in ('live', 'finished')
  then
    active_window_id := public.preparar_ranking_janela(current_jogo.id);
  end if;

  update public.jogos
  set
    gols1 = coalesce(p_gols1, gols1),
    gols2 = coalesce(p_gols2, gols2),
    encerrado = encerrado or coalesce(p_encerrado, false) or normalized_status = 'finished',
    placar_status = coalesce(normalized_status, placar_status),
    sportsdb_status = p_status,
    sincronizado_em = now()
  where id = current_jogo.id
  returning * into updated_jogo;

  if updated_jogo.encerrado then
    perform 1 from public.recalcular_pontuacao_jogo(updated_jogo.id);

    if to_regprocedure('public.recalcular_grupos()') is not null then
      perform public.recalcular_grupos();
    end if;

    if active_window_id is null then
      select janela_id
      into active_window_id
      from public.ranking_janela_jogos
      where jogo_id = updated_jogo.id;
    end if;

    if active_window_id is not null then
      perform public.finalizar_ranking_janela_se_pronta(active_window_id);
    end if;
  end if;

  return updated_jogo;
end;
$$;

revoke execute on function public.atualizar_placar_jogo_sportsdb(
  text, integer, integer, boolean, text
) from public, anon, authenticated;
grant execute on function public.atualizar_placar_jogo_sportsdb(
  text, integer, integer, boolean, text
) to service_role;

create or replace function public.atualizar_placar_jogo_worldcup2026(
  p_worldcup2026_game_id text,
  p_gols1 integer,
  p_gols2 integer,
  p_placar_status text,
  p_status_origem text default null
)
returns public.jogos
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status public.jogo_placar_status;
  current_jogo public.jogos;
  updated_jogo public.jogos;
  active_window_id uuid;
begin
  normalized_status := case lower(coalesce(p_placar_status, 'upcoming'))
    when 'finished' then 'finished'::public.jogo_placar_status
    when 'live' then 'live'::public.jogo_placar_status
    else 'upcoming'::public.jogo_placar_status
  end;

  select *
  into current_jogo
  from public.jogos
  where worldcup2026_game_id = p_worldcup2026_game_id
  for update;

  if current_jogo.id is null then
    return null;
  end if;

  if not current_jogo.encerrado
    and normalized_status in ('live', 'finished')
  then
    active_window_id := public.preparar_ranking_janela(current_jogo.id);
  end if;

  update public.jogos
  set
    gols1 = case
      when normalized_status = 'upcoming' then gols1
      else coalesce(p_gols1, gols1)
    end,
    gols2 = case
      when normalized_status = 'upcoming' then gols2
      else coalesce(p_gols2, gols2)
    end,
    encerrado = encerrado or normalized_status = 'finished',
    placar_status = normalized_status,
    sportsdb_status = p_status_origem,
    sincronizado_em = now()
  where id = current_jogo.id
  returning * into updated_jogo;

  if updated_jogo.encerrado then
    perform 1 from public.recalcular_pontuacao_jogo(updated_jogo.id);

    if to_regprocedure('public.recalcular_grupos()') is not null then
      perform public.recalcular_grupos();
    end if;

    if active_window_id is not null then
      perform public.finalizar_ranking_janela_se_pronta(active_window_id);
    end if;
  end if;

  return updated_jogo;
end;
$$;

revoke execute on function public.atualizar_placar_jogo_worldcup2026(
  text, integer, integer, text, text
) from public, anon, authenticated;
grant execute on function public.atualizar_placar_jogo_worldcup2026(
  text, integer, integer, text, text
) to service_role;
