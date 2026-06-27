create table if not exists public.palpites_chaveamento (
  user_id uuid not null references public.usuarios(id) on delete cascade,
  fase_id integer not null references public.fases(id),
  slot integer not null,
  time1 text not null,
  time2 text not null,
  vencedor text not null,
  pontos integer not null default 0,
  acertou boolean,
  calculado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, fase_id, slot),
  constraint palpites_chaveamento_slot_valido check (slot >= 0),
  constraint palpites_chaveamento_times_diferentes check (time1 <> time2),
  constraint palpites_chaveamento_vencedor_valido check (vencedor = time1 or vencedor = time2)
);

create index if not exists palpites_chaveamento_user_id_idx
on public.palpites_chaveamento (user_id);

create index if not exists palpites_chaveamento_fase_slot_idx
on public.palpites_chaveamento (fase_id, slot);

drop trigger if exists set_palpites_chaveamento_updated_at on public.palpites_chaveamento;
create trigger set_palpites_chaveamento_updated_at
before update on public.palpites_chaveamento
for each row
execute function public.set_updated_at();

alter table public.palpites_chaveamento enable row level security;

create or replace function public.chaveamento_prazo_limite()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select min(data)
  from public.jogos
  where fase_id > 1
    and fase_id <> 6;
$$;

create or replace function public.chaveamento_prazo_aberto()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.jogos
    where fase_id = 1
  )
  and not exists (
    select 1
    from public.jogos
    where fase_id = 1
      and not encerrado
  )
  and public.chaveamento_prazo_limite() is not null
  and now() < public.chaveamento_prazo_limite();
$$;

revoke execute on function public.chaveamento_prazo_limite()
from public, anon, authenticated;

revoke execute on function public.chaveamento_prazo_aberto()
from public, anon, authenticated;

drop policy if exists "Usuarios podem ler o proprio chaveamento" on public.palpites_chaveamento;
create policy "Usuarios podem ler o proprio chaveamento"
on public.palpites_chaveamento
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Usuarios podem criar o proprio chaveamento" on public.palpites_chaveamento;
create policy "Usuarios podem criar o proprio chaveamento"
on public.palpites_chaveamento
for insert
to authenticated
with check ((select auth.uid()) = user_id and public.chaveamento_prazo_aberto());

drop policy if exists "Usuarios podem atualizar o proprio chaveamento" on public.palpites_chaveamento;
create policy "Usuarios podem atualizar o proprio chaveamento"
on public.palpites_chaveamento
for update
to authenticated
using ((select auth.uid()) = user_id and public.chaveamento_prazo_aberto())
with check ((select auth.uid()) = user_id and public.chaveamento_prazo_aberto());

drop policy if exists "Usuarios podem apagar o proprio chaveamento" on public.palpites_chaveamento;
create policy "Usuarios podem apagar o proprio chaveamento"
on public.palpites_chaveamento
for delete
to authenticated
using ((select auth.uid()) = user_id and public.chaveamento_prazo_aberto());

create or replace function public.pontos_chaveamento_usuario(p_user_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(sum(pc.pontos), 0)::integer
  from public.palpites_chaveamento pc
  where pc.user_id = p_user_id;
$$;

revoke execute on function public.pontos_chaveamento_usuario(uuid)
from public, anon, authenticated;

create or replace function public.recalcular_pontuacao_chaveamento()
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
  with reais as (
    select distinct
      fase_id,
      least(time1, time2) as time_a,
      greatest(time1, time2) as time_b
    from public.jogos
    where fase_id >= 3
      and fase_id <> 6
      and time1 is not null
      and time2 is not null
  ),
  avaliados as (
    select
      pc.user_id,
      pc.fase_id,
      pc.slot,
      exists (
        select 1
        from reais r
        where r.fase_id = pc.fase_id
          and r.time_a = least(pc.time1, pc.time2)
          and r.time_b = greatest(pc.time1, pc.time2)
      ) as acertou
    from public.palpites_chaveamento pc
    where pc.fase_id >= 3
      and pc.fase_id <> 6
  )
  update public.palpites_chaveamento pc
  set
    acertou = avaliados.acertou,
    pontos = case when avaliados.acertou then 5 else 0 end,
    calculado_em = now()
  from avaliados
  where pc.user_id = avaliados.user_id
    and pc.fase_id = avaliados.fase_id
    and pc.slot = avaliados.slot;

  get diagnostics calculated_count = row_count;

  update public.palpites_chaveamento pc
  set
    acertou = null,
    pontos = 0,
    calculado_em = now()
  where pc.fase_id < 3
     or pc.fase_id = 6;

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

  return query select calculated_count, updated_users_count;
end;
$$;

revoke execute on function public.recalcular_pontuacao_chaveamento()
from public, anon;
grant execute on function public.recalcular_pontuacao_chaveamento()
to authenticated, service_role;

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

  perform 1 from public.recalcular_pontuacao_chaveamento();

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

  return query select calculated_count, updated_users_count;
end;
$$;

revoke execute on function public.recalcular_pontuacao_jogo(uuid)
from public, anon, authenticated;
grant execute on function public.recalcular_pontuacao_jogo(uuid) to service_role;

create or replace function public.recalcular_ranking_completo()
returns table (
  jogos_recalculados integer,
  usuarios_atualizados integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  jogo record;
  jogos_count integer := 0;
  users_count integer := 0;
begin
  for jogo in
    select id
    from public.jogos
    where encerrado = true
    order by data asc
  loop
    perform 1
    from public.recalcular_pontuacao_jogo(jogo.id);

    jogos_count := jogos_count + 1;
  end loop;

  perform 1 from public.recalcular_pontuacao_chaveamento();

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

  get diagnostics users_count = row_count;

  return query select jogos_count, users_count;
end;
$$;

grant execute on function public.recalcular_ranking_completo()
to anon, authenticated;

create or replace function public.recalcular_ranking_completo_admin()
returns table (
  jogos_recalculados integer,
  usuarios_atualizados integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((select public.is_admin()), false) is not true then
    raise exception 'Acesso negado para recalcular ranking completo.';
  end if;

  return query
  select *
  from public.recalcular_ranking_completo();
end;
$$;

revoke execute on function public.recalcular_ranking_completo_admin()
from public, anon, authenticated;
grant execute on function public.recalcular_ranking_completo_admin()
to authenticated, service_role;
