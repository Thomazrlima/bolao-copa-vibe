drop policy if exists "Administradores podem ler bug reports"
on public.bug_reports;

create policy "Administradores podem ler bug reports"
on public.bug_reports
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'ana.gomes@visagio.com',
    'gabriel.cavalcanti@visagio.com',
    'paulo.rosado@visagio.com',
    'sophia.gallindo@visagio.com',
    'thomaz.lima@visagio.com'
  )
);

grant select on public.bug_reports to authenticated;
