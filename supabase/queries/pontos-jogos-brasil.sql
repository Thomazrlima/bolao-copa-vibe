-- Ranking de participantes que mais pontuaram nos jogos do Brasil.
-- Considera somente jogos encerrados e os pontos ja calculados em public.palpites.
select
  u.id as user_id,
  u.nome_completo,
  count(*) as jogos_do_brasil_palpitados,
  sum(coalesce(p.pontos, 0))::integer as pontos_jogos_brasil,
  sum(case when p.chinelada then 1 else 0 end)::integer as chineladas,
  round(avg(coalesce(p.pontos, 0))::numeric, 2) as media_pontos
from public.palpites p
join public.jogos j
  on j.id = p.jogo_id
join public.usuarios u
  on u.id = p.user_id
where
  j.encerrado = true
  and (j.time1 = 'Brasil' or j.time2 = 'Brasil')
group by
  u.id,
  u.nome_completo
order by
  pontos_jogos_brasil desc,
  chineladas desc,
  media_pontos desc,
  u.nome_completo asc;

-- Detalhe por jogo e participante.
select
  u.id as user_id,
  u.nome_completo,
  j.id as jogo_id,
  j.codigo_mata_mata,
  j.fase_id,
  j.data,
  j.time1,
  j.time2,
  j.gols1,
  j.gols2,
  p.gols1 as palpite_gols1,
  p.gols2 as palpite_gols2,
  p.pontos,
  p.chinelada,
  p.calculado_em,
  p.criado_em
from public.palpites p
join public.jogos j
  on j.id = p.jogo_id
join public.usuarios u
  on u.id = p.user_id
where
  j.encerrado = true
  and (j.time1 = 'Brasil' or j.time2 = 'Brasil')
order by
  u.nome_completo asc,
  j.data asc;

-- Agregacao por participante, com todos os pontos somados.
-- Ordena por quem mais pontuou nos jogos do Brasil.
select
  u.id as user_id,
  u.nome_completo,
  sum(coalesce(p.pontos, 0))::integer as total_pontos,
  count(*)::integer as quantidade_palpites,
  sum(case when p.chinelada then 1 else 0 end)::integer as chineladas,
  round(avg(coalesce(p.pontos, 0))::numeric, 2) as media_pontos
from public.palpites p
join public.jogos j
  on j.id = p.jogo_id
join public.usuarios u
  on u.id = p.user_id
where
  j.encerrado = true
  and (j.time1 = 'Brasil' or j.time2 = 'Brasil')
group by
  u.id,
  u.nome_completo
order by
  total_pontos desc,
  chineladas desc,
  media_pontos desc,
  u.nome_completo asc;
