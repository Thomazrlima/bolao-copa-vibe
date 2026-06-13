create table if not exists public.palpites_especiais_respostas_corretas (
  pergunta_id text primary key,
  resposta text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint palpites_especiais_respostas_corretas_pergunta_id_nao_vazia check (length(trim(pergunta_id)) > 0),
  constraint palpites_especiais_respostas_corretas_resposta_nao_vazia check (length(trim(resposta)) > 0)
);

alter table public.palpites_especiais_respostas_corretas enable row level security;
