alter table public.bug_reports
drop constraint if exists bug_reports_descricao_nao_vazia;

alter table public.bug_reports
add constraint bug_reports_descricao_nao_vazia
check (length(trim(descricao)) >= 1);
