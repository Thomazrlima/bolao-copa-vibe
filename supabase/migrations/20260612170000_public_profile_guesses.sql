drop policy if exists "Palpites podem ser vistos nos perfis" on public.palpites;

create policy "Palpites podem ser vistos nos perfis"
on public.palpites
for select
to anon, authenticated
using (true);
