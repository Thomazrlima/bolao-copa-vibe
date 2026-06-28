create or replace function public.chaveamento_prazo_limite()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select timestamptz '2026-06-29 14:00:00 America/Sao_Paulo';
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
from public, anon;

revoke execute on function public.chaveamento_prazo_aberto()
from public, anon;

grant execute on function public.chaveamento_prazo_limite()
to authenticated, service_role;

grant execute on function public.chaveamento_prazo_aberto()
to authenticated, service_role;
