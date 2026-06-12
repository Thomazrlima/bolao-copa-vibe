grant select on public.palpites to anon, authenticated;

drop policy if exists "Usuarios podem ler os proprios palpites" on public.palpites;
drop policy if exists "Palpites podem ser vistos nos perfis" on public.palpites;
drop policy if exists "Palpites podem ser vistos publicamente" on public.palpites;
create policy "Palpites podem ser vistos publicamente"
on public.palpites
for select
to anon, authenticated
using (true);

create or replace function public.listar_palpites_perfil(p_user_id uuid)
returns table (
  jogo_id uuid,
  fase_id integer,
  time1 text,
  time2 text,
  gols1 integer,
  gols2 integer,
  pontos integer,
  chinelada boolean,
  calculado_em timestamptz,
  criado_em timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.jogo_id,
    p.fase_id,
    p.time1,
    p.time2,
    p.gols1,
    p.gols2,
    p.pontos,
    p.chinelada,
    p.calculado_em,
    p.criado_em
  from public.palpites p
  where p.user_id = p_user_id
  order by p.criado_em desc;
$$;

grant execute on function public.listar_palpites_perfil(uuid) to anon, authenticated;

create or replace function public.listar_palpites_jogo(p_jogo_id uuid)
returns table (
  user_id uuid,
  jogo_id uuid,
  fase_id integer,
  time1 text,
  time2 text,
  gols1 integer,
  gols2 integer,
  pontos integer,
  chinelada boolean,
  calculado_em timestamptz,
  criado_em timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.jogo_id,
    p.fase_id,
    p.time1,
    p.time2,
    p.gols1,
    p.gols2,
    p.pontos,
    p.chinelada,
    p.calculado_em,
    p.criado_em
  from public.palpites p
  where p.jogo_id = p_jogo_id
  order by p.criado_em desc;
$$;

grant execute on function public.listar_palpites_jogo(uuid) to anon, authenticated;
