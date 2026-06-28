create or replace function public.set_palpites_chaveamento_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists set_palpites_chaveamento_updated_at on public.palpites_chaveamento;

create trigger set_palpites_chaveamento_updated_at
before update on public.palpites_chaveamento
for each row
execute function public.set_palpites_chaveamento_atualizado_em();

revoke execute on function public.set_palpites_chaveamento_atualizado_em()
from public, anon, authenticated;
