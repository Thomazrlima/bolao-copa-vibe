alter table public.palpites_especiais_respostas_corretas
drop constraint if exists palpites_especiais_respostas_corretas_pkey;

alter table public.palpites_especiais_respostas_corretas
add constraint palpites_especiais_respostas_corretas_pkey
primary key (pergunta_id, resposta);

create index if not exists palpites_especiais_respostas_corretas_pergunta_id_idx
on public.palpites_especiais_respostas_corretas (pergunta_id);

notify pgrst, 'reload schema';
