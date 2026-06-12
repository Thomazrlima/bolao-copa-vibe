alter table public.jogos
add column if not exists rodada integer;

alter table public.jogos
drop constraint if exists jogos_rodada_valida;

alter table public.jogos
add constraint jogos_rodada_valida
check (rodada is null or rodada > 0);

insert into public.fases (id, nome, ordem)
values
  (1, 'Grupos', 1),
  (2, '16-avos', 2),
  (3, 'Oitavas', 3),
  (4, 'Quartas', 4),
  (5, 'Semifinal', 5),
  (6, 'Disputa de 3º', 6),
  (7, 'Final', 7)
on conflict (id) do update
set
  nome = excluded.nome,
  ordem = excluded.ordem;
