create table if not exists public.palpites_especiais (
  user_id uuid not null references public.usuarios(id) on delete cascade,
  pergunta_id text not null,
  resposta text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, pergunta_id),
  constraint palpites_especiais_pergunta_id_nao_vazia check (length(trim(pergunta_id)) > 0),
  constraint palpites_especiais_resposta_nao_vazia check (length(trim(resposta)) > 0)
);

create index if not exists palpites_especiais_pergunta_id_idx
on public.palpites_especiais (pergunta_id);

alter table public.palpites_especiais enable row level security;

drop policy if exists "Usuarios podem ler os proprios palpites especiais"
on public.palpites_especiais;
create policy "Usuarios podem ler os proprios palpites especiais"
on public.palpites_especiais
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Usuarios podem criar os proprios palpites especiais"
on public.palpites_especiais;
create policy "Usuarios podem criar os proprios palpites especiais"
on public.palpites_especiais
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Usuarios podem atualizar os proprios palpites especiais"
on public.palpites_especiais;
create policy "Usuarios podem atualizar os proprios palpites especiais"
on public.palpites_especiais
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.palpites_especiais to authenticated;
