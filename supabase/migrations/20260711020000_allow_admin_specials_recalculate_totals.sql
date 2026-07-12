create or replace function public.recalcular_totais_usuarios_admin()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.usuario_e_admin_bolao() then
    raise exception 'Acesso negado para recalcular totais.';
  end if;

  return public.recalcular_totais_usuarios();
end;
$$;

revoke execute on function public.recalcular_totais_usuarios_admin()
from public, anon;

grant execute on function public.recalcular_totais_usuarios_admin()
to authenticated, service_role;

notify pgrst, 'reload schema';
