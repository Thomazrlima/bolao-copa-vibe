create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  nome text,
  email text not null,
  pagina text,
  descricao text not null,
  passos text,
  esperado text,
  atual text,
  navegador text,
  status text not null default 'novo',
  criado_em timestamptz not null default now(),
  constraint bug_reports_email_valido check (position('@' in email) > 1),
  constraint bug_reports_descricao_nao_vazia check (length(trim(descricao)) >= 1),
  constraint bug_reports_status_valido check (status in ('novo', 'em_analise', 'resolvido', 'ignorado'))
);

create index if not exists bug_reports_criado_em_idx
on public.bug_reports (criado_em desc);

create index if not exists bug_reports_user_id_idx
on public.bug_reports (user_id);

alter table public.bug_reports enable row level security;

drop policy if exists "Qualquer visitante pode criar bug reports"
on public.bug_reports;

drop policy if exists "Usuarios autenticados podem criar bug reports"
on public.bug_reports;

create policy "Usuarios autenticados podem criar bug reports"
on public.bug_reports
for insert
to authenticated
with check (auth.uid() = user_id);

grant insert on public.bug_reports to authenticated;
