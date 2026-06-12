alter table public.palpites
add column if not exists pontos integer not null default 0,
add column if not exists chinelada boolean not null default false,
add column if not exists calculado_em timestamptz;

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
      when p.gols1 = j.gols1 and p.gols2 = j.gols2 then 10
      when sign(p.gols1 - p.gols2) = sign(j.gols1 - j.gols2)
        and (
          p.gols1 = j.gols1
          or p.gols2 = j.gols2
          or abs(p.gols1 - p.gols2) = abs(j.gols1 - j.gols2)
        ) then 7
      when sign(p.gols1 - p.gols2) = sign(j.gols1 - j.gols2) then 5
      when p.gols1 = j.gols1 or p.gols2 = j.gols2 then 2
      else 0
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
      coalesce(sum(p.pontos), 0)::integer as pontos,
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

grant execute on function public.recalcular_pontuacao_jogo(uuid)
to anon, authenticated;

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
  updated_jogo public.jogos;
begin
  update public.jogos
  set
    gols1 = coalesce(p_gols1, gols1),
    gols2 = coalesce(p_gols2, gols2),
    encerrado = coalesce(p_encerrado, encerrado),
    sportsdb_status = p_status,
    sincronizado_em = now()
  where sportsdb_event_id = p_sportsdb_event_id
  returning * into updated_jogo;

  if updated_jogo.id is not null and updated_jogo.encerrado then
    perform 1
    from public.recalcular_pontuacao_jogo(updated_jogo.id);
  end if;

  return updated_jogo;
end;
$$;

grant execute on function public.atualizar_placar_jogo_sportsdb(text, integer, integer, boolean, text)
to anon, authenticated;
