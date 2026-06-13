create or replace function public.usuario_e_admin_bolao()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'ana.gomes@visagio.com',
    'gabriel.cavalcanti@visagio.com',
    'paulo.rosado@visagio.com',
    'sophia.gallindo@visagio.com',
    'thomaz.lima@visagio.com'
  );
$$;

revoke execute on function public.usuario_e_admin_bolao() from public, anon;
grant execute on function public.usuario_e_admin_bolao() to authenticated;

grant select, insert, update, delete
on public.palpites_especiais_respostas_corretas
to authenticated;

drop policy if exists "Admins podem ler respostas corretas especiais"
on public.palpites_especiais_respostas_corretas;
create policy "Admins podem ler respostas corretas especiais"
on public.palpites_especiais_respostas_corretas
for select
to authenticated
using (public.usuario_e_admin_bolao());

drop policy if exists "Admins podem criar respostas corretas especiais"
on public.palpites_especiais_respostas_corretas;
create policy "Admins podem criar respostas corretas especiais"
on public.palpites_especiais_respostas_corretas
for insert
to authenticated
with check (public.usuario_e_admin_bolao());

drop policy if exists "Admins podem atualizar respostas corretas especiais"
on public.palpites_especiais_respostas_corretas;
create policy "Admins podem atualizar respostas corretas especiais"
on public.palpites_especiais_respostas_corretas
for update
to authenticated
using (public.usuario_e_admin_bolao())
with check (public.usuario_e_admin_bolao());

drop policy if exists "Admins podem apagar respostas corretas especiais"
on public.palpites_especiais_respostas_corretas;
create policy "Admins podem apagar respostas corretas especiais"
on public.palpites_especiais_respostas_corretas
for delete
to authenticated
using (public.usuario_e_admin_bolao());

create or replace function public.pontos_especiais_usuario(p_user_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(
    sum(
      case
        when pe.pergunta_id = 'campeao-bolao' then 25
        else 15
      end
    ),
    0
  )::integer
  from public.palpites_especiais pe
  join public.palpites_especiais_respostas_corretas rc
    on rc.pergunta_id = pe.pergunta_id
   and rc.resposta = pe.resposta
  where pe.user_id = p_user_id;
$$;

revoke execute on function public.pontos_especiais_usuario(uuid)
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

  get diagnostics users_count = row_count;

  return query select jogos_count, users_count;
end;
$$;

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
  if not public.usuario_e_admin_bolao() then
    raise exception 'Sem permissao para recalcular o ranking.';
  end if;

  return query
  select *
  from public.recalcular_ranking_completo();
end;
$$;

revoke execute on function public.recalcular_ranking_completo_admin()
from public, anon;
grant execute on function public.recalcular_ranking_completo_admin()
to authenticated;
