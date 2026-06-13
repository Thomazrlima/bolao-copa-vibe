drop policy if exists "Qualquer visitante pode criar bug reports"
on public.bug_reports;

drop policy if exists "Usuarios autenticados podem criar bug reports"
on public.bug_reports;

create policy "Usuarios autenticados podem criar bug reports"
on public.bug_reports
for insert
to authenticated
with check (auth.uid() = user_id);

revoke insert on public.bug_reports from anon;
grant insert on public.bug_reports to authenticated;
