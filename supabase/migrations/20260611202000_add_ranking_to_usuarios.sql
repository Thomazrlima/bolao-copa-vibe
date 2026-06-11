alter table public.usuarios
add column if not exists pontos integer not null default 0,
add column if not exists chineladas integer not null default 0;

create or replace view public.ranking_usuarios as
select
  id,
  nome_completo,
  pontos,
  chineladas
from public.usuarios;

grant select on public.ranking_usuarios to anon, authenticated;
