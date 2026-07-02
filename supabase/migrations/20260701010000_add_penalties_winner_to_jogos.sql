alter table public.jogos
add column if not exists penaltis1 integer,
add column if not exists penaltis2 integer,
add column if not exists vencedor text;

alter table public.jogos
drop constraint if exists jogos_penaltis1_nao_negativo,
drop constraint if exists jogos_penaltis2_nao_negativo,
drop constraint if exists jogos_penaltis_preenchidos_juntos,
drop constraint if exists jogos_vencedor_valido;

alter table public.jogos
add constraint jogos_penaltis1_nao_negativo
check (penaltis1 is null or penaltis1 >= 0);

alter table public.jogos
add constraint jogos_penaltis2_nao_negativo
check (penaltis2 is null or penaltis2 >= 0);

alter table public.jogos
add constraint jogos_penaltis_preenchidos_juntos
check (
  (penaltis1 is null and penaltis2 is null)
  or (penaltis1 is not null and penaltis2 is not null)
);

alter table public.jogos
add constraint jogos_vencedor_valido
check (vencedor is null or vencedor = time1 or vencedor = time2);

drop function if exists public.atualizar_placar_jogo_sportsdb(
  text, integer, integer, boolean, text
);

create or replace function public.atualizar_placar_jogo_sportsdb(
  p_sportsdb_event_id text,
  p_gols1 integer,
  p_gols2 integer,
  p_encerrado boolean,
  p_status text default null,
  p_penaltis1 integer default null,
  p_penaltis2 integer default null,
  p_vencedor text default null
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
      'ft', 'aet', 'ap', 'pen', 'match finished', 'finished', 'full time', 'after penalties'
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
    penaltis1 = coalesce(p_penaltis1, penaltis1),
    penaltis2 = coalesce(p_penaltis2, penaltis2),
    vencedor = case
      when p_vencedor in (time1, time2) then p_vencedor
      when coalesce(p_gols1, gols1) > coalesce(p_gols2, gols2) then time1
      when coalesce(p_gols1, gols1) < coalesce(p_gols2, gols2) then time2
      when coalesce(p_penaltis1, penaltis1) > coalesce(p_penaltis2, penaltis2) then time1
      when coalesce(p_penaltis1, penaltis1) < coalesce(p_penaltis2, penaltis2) then time2
      else vencedor
    end,
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
  text, integer, integer, boolean, text, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.atualizar_placar_jogo_sportsdb(
  text, integer, integer, boolean, text, integer, integer, text
) to service_role;
