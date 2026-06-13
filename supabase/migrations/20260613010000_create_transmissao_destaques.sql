create table if not exists public.transmissao_destaques (
  slot smallint primary key,
  jogo_id uuid not null unique references public.jogos(id) on delete cascade,
  updated_at timestamptz not null default now(),
  constraint transmissao_destaques_slot_valido check (slot in (1, 2))
);

alter table public.transmissao_destaques enable row level security;

drop policy if exists "Destaques de transmissao podem ser lidos por todos"
on public.transmissao_destaques;

create policy "Destaques de transmissao podem ser lidos por todos"
on public.transmissao_destaques
for select
to anon, authenticated
using (true);

grant select on public.transmissao_destaques to anon, authenticated;

insert into public.transmissao_destaques (slot, jogo_id)
select row_number() over (order by data asc)::smallint, id
from public.jogos
where transmissao_url is not null
  and length(trim(transmissao_url)) > 0
order by data asc
limit 2
on conflict (slot) do nothing;
