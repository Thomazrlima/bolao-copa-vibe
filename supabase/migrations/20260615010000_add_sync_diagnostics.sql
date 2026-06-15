create table if not exists public.sync_jogos_execucoes (
  id uuid primary key default gen_random_uuid(),
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  sucesso boolean,
  erro text,
  duracao_ms integer,
  resumo jsonb not null default '{}'::jsonb,
  diagnosticos jsonb not null default '[]'::jsonb
);

create index if not exists sync_jogos_execucoes_iniciado_em_idx
on public.sync_jogos_execucoes (iniciado_em desc);

alter table public.sync_jogos_execucoes enable row level security;

revoke all on public.sync_jogos_execucoes from public, anon, authenticated;
grant select, insert, update, delete on public.sync_jogos_execucoes to service_role;

comment on table public.sync_jogos_execucoes is
'Histórico técnico das execuções do cron de placares, incluindo respostas dos provedores.';
