drop view if exists public.ranking_usuarios;

create view public.ranking_usuarios as
select
  id,
  nome_completo,
  pontos,
  chineladas
from public.usuarios;

grant select on public.ranking_usuarios to anon, authenticated;
