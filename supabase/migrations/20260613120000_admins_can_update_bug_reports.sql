drop policy if exists "Administradores podem atualizar bug reports"
on public.bug_reports;

create policy "Administradores podem atualizar bug reports"
on public.bug_reports
for update
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'ana.gomes@visagio.com',
    'gabriel.cavalcanti@visagio.com',
    'paulo.rosado@visagio.com',
    'sophia.gallindo@visagio.com',
    'thomaz.lima@visagio.com'
  )
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'ana.gomes@visagio.com',
    'gabriel.cavalcanti@visagio.com',
    'paulo.rosado@visagio.com',
    'sophia.gallindo@visagio.com',
    'thomaz.lima@visagio.com'
  )
);

grant update (status) on public.bug_reports to authenticated;
