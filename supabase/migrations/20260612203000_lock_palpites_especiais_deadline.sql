drop policy if exists "Usuarios podem criar os proprios palpites especiais"
on public.palpites_especiais;
create policy "Usuarios podem criar os proprios palpites especiais"
on public.palpites_especiais
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and now() < timestamptz '2026-06-13 19:00:00+00'
);

drop policy if exists "Usuarios podem atualizar os proprios palpites especiais"
on public.palpites_especiais;
create policy "Usuarios podem atualizar os proprios palpites especiais"
on public.palpites_especiais
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and now() < timestamptz '2026-06-13 19:00:00+00'
)
with check (
  (select auth.uid()) = user_id
  and now() < timestamptz '2026-06-13 19:00:00+00'
);
