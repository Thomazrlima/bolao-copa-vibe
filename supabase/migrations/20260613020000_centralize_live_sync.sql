create table if not exists public.realtime_atualizacoes (
  canal text primary key,
  versao bigint not null default 1,
  atualizado_em timestamptz not null default now()
);

alter table public.realtime_atualizacoes enable row level security;

drop policy if exists "Atualizacoes em tempo real podem ser lidas por todos"
on public.realtime_atualizacoes;

create policy "Atualizacoes em tempo real podem ser lidas por todos"
on public.realtime_atualizacoes
for select
to anon, authenticated
using (true);

grant select on public.realtime_atualizacoes to anon, authenticated;

insert into public.realtime_atualizacoes (canal)
values
  ('jogos'),
  ('grupos'),
  ('ranking'),
  ('palpites'),
  ('transmissoes'),
  ('bugs')
on conflict (canal) do nothing;

create or replace function public.sinalizar_atualizacao_realtime()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.realtime_atualizacoes (canal, versao, atualizado_em)
  values (tg_argv[0], 1, now())
  on conflict (canal) do update
  set
    versao = public.realtime_atualizacoes.versao + 1,
    atualizado_em = excluded.atualizado_em;

  return null;
end;
$$;

revoke execute on function public.sinalizar_atualizacao_realtime() from public, anon, authenticated;

drop trigger if exists sinalizar_jogos_realtime on public.jogos;
create trigger sinalizar_jogos_realtime
after insert or update or delete on public.jogos
for each statement
execute function public.sinalizar_atualizacao_realtime('jogos');

drop trigger if exists sinalizar_grupos_realtime on public.grupos;
create trigger sinalizar_grupos_realtime
after insert or update or delete on public.grupos
for each statement
execute function public.sinalizar_atualizacao_realtime('grupos');

drop trigger if exists sinalizar_ranking_realtime on public.usuarios;
create trigger sinalizar_ranking_realtime
after insert or update or delete on public.usuarios
for each statement
execute function public.sinalizar_atualizacao_realtime('ranking');

drop trigger if exists sinalizar_palpites_realtime on public.palpites;
create trigger sinalizar_palpites_realtime
after insert or update or delete on public.palpites
for each statement
execute function public.sinalizar_atualizacao_realtime('palpites');

drop trigger if exists sinalizar_transmissoes_realtime on public.transmissao_destaques;
create trigger sinalizar_transmissoes_realtime
after insert or update or delete on public.transmissao_destaques
for each statement
execute function public.sinalizar_atualizacao_realtime('transmissoes');

drop trigger if exists sinalizar_bugs_realtime on public.bug_reports;
create trigger sinalizar_bugs_realtime
after insert or update or delete on public.bug_reports
for each statement
execute function public.sinalizar_atualizacao_realtime('bugs');

do $$
begin
  alter publication supabase_realtime add table public.realtime_atualizacoes;
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.sync_jogos_estado (
  id boolean primary key default true,
  bloqueado_ate timestamptz,
  ultima_tentativa timestamptz,
  ultimo_sucesso timestamptz,
  ultimo_erro text,
  jogos_elegiveis integer not null default 0,
  jogos_sincronizados integer not null default 0,
  duracao_ms integer,
  constraint sync_jogos_estado_singleton check (id)
);

alter table public.sync_jogos_estado enable row level security;

insert into public.sync_jogos_estado (id)
values (true)
on conflict (id) do nothing;

create or replace function public.tentar_iniciar_sync_jogos(p_lock_segundos integer default 90)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  adquirido boolean := false;
begin
  update public.sync_jogos_estado
  set
    bloqueado_ate = now() + make_interval(secs => greatest(p_lock_segundos, 30)),
    ultima_tentativa = now()
  where id = true
    and (bloqueado_ate is null or bloqueado_ate < now())
  returning true into adquirido;

  return coalesce(adquirido, false);
end;
$$;

create or replace function public.finalizar_sync_jogos(
  p_sucesso boolean,
  p_erro text default null,
  p_jogos_elegiveis integer default 0,
  p_jogos_sincronizados integer default 0,
  p_duracao_ms integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sync_jogos_estado
  set
    bloqueado_ate = null,
    ultimo_sucesso = case when p_sucesso then now() else ultimo_sucesso end,
    ultimo_erro = case when p_sucesso then null else left(coalesce(p_erro, 'Erro desconhecido'), 2000) end,
    jogos_elegiveis = greatest(coalesce(p_jogos_elegiveis, 0), 0),
    jogos_sincronizados = greatest(coalesce(p_jogos_sincronizados, 0), 0),
    duracao_ms = p_duracao_ms
  where id = true;
end;
$$;

revoke all on public.sync_jogos_estado from anon, authenticated;
revoke execute on function public.tentar_iniciar_sync_jogos(integer) from public, anon, authenticated;
revoke execute on function public.finalizar_sync_jogos(boolean, text, integer, integer, integer)
from public, anon, authenticated;

grant select on public.sync_jogos_estado to service_role;
grant execute on function public.tentar_iniciar_sync_jogos(integer) to service_role;
grant execute on function public.finalizar_sync_jogos(boolean, text, integer, integer, integer)
to service_role;

do $$
begin
  if to_regprocedure(
    'public.atualizar_placar_jogo_worldcup2026(text,integer,integer,text,text)'
  ) is not null then
    revoke execute on function public.atualizar_placar_jogo_worldcup2026(
      text, integer, integer, text, text
    ) from public, anon, authenticated;
    grant execute on function public.atualizar_placar_jogo_worldcup2026(
      text, integer, integer, text, text
    ) to service_role;
  end if;

  if to_regprocedure(
    'public.atualizar_placar_jogo_sportsdb(text,integer,integer,boolean,text)'
  ) is not null then
    revoke execute on function public.atualizar_placar_jogo_sportsdb(
      text, integer, integer, boolean, text
    ) from public, anon, authenticated;
    grant execute on function public.atualizar_placar_jogo_sportsdb(
      text, integer, integer, boolean, text
    ) to service_role;
  end if;

  if to_regprocedure('public.recalcular_pontuacao_jogo(uuid)') is not null then
    revoke execute on function public.recalcular_pontuacao_jogo(uuid)
    from public, anon, authenticated;
    grant execute on function public.recalcular_pontuacao_jogo(uuid) to service_role;
  end if;

  if to_regprocedure('public.recalcular_ranking_completo()') is not null then
    revoke execute on function public.recalcular_ranking_completo()
    from public, anon, authenticated;
    grant execute on function public.recalcular_ranking_completo() to service_role;
  end if;

  if to_regprocedure('public.recalcular_grupos()') is not null then
    revoke execute on function public.recalcular_grupos()
    from public, anon, authenticated;
    grant execute on function public.recalcular_grupos() to service_role;
  end if;
end;
$$;
