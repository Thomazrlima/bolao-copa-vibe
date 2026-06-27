create or replace function public.chaveamento_prazo_limite()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select timestamptz '2026-07-29 14:00:00 America/Sao_Paulo';
$$;

create or replace function public.chaveamento_prazo_aberto()
returns boolean
language sql
stable
set search_path = public
as $$
  select now() < public.chaveamento_prazo_limite();
$$;

revoke execute on function public.chaveamento_prazo_limite()
from public, anon, authenticated;

revoke execute on function public.chaveamento_prazo_aberto()
from public, anon, authenticated;

create or replace function public.pontuacao_especiais_perfil(p_user_id uuid)
returns table (
  acertos integer,
  pontos integer
)
language sql
security definer
set search_path = public
as $$
  with especiais as (
    select
      count(*)::integer as acertos,
      coalesce(
        sum(
          case
            when pe.pergunta_id = 'campeao-bolao' then 25
            else 15
          end
        ),
        0
      )::integer as pontos
    from public.palpites_especiais pe
    join public.palpites_especiais_respostas_corretas rc
      on rc.pergunta_id = pe.pergunta_id
     and rc.resposta = pe.resposta
    where pe.user_id = p_user_id
  ),
  chaveamento as (
    select
      count(*) filter (where pc.acertou is true)::integer as acertos,
      coalesce(sum(pc.pontos), 0)::integer as pontos
    from public.palpites_chaveamento pc
    where pc.user_id = p_user_id
  )
  select
    (especiais.acertos + chaveamento.acertos)::integer as acertos,
    (especiais.pontos + chaveamento.pontos)::integer as pontos
  from especiais
  cross join chaveamento;
$$;

grant execute on function public.pontuacao_especiais_perfil(uuid)
to anon, authenticated;
