alter table public.usuarios
add column if not exists avatar_url text;

create or replace view public.ranking_usuarios as
select
  id,
  nome_completo,
  avatar_url,
  pontos,
  chineladas
from public.usuarios;

grant select on public.ranking_usuarios to anon, authenticated;
