
# Bolão dos v(devers)

App SPA TanStack Start, dark mode por padrão, paleta preto & amarelo, 100% frontend com mocks persistidos em localStorage. Sem login. Layout dashboard esportivo responsivo.

## Stack e estrutura

- TanStack Start + React + TS + Tailwind v4 + shadcn/ui (já no template)
- framer-motion para microanimações (entrada de cards, swap de chaveamento)
- Persistência: `localStorage` via hook `useLocalState` (mocks como seed)
- Sem backend (Lovable Cloud não será habilitado)

```
src/
  routes/
    __root.tsx              # shell + nav de tabs + SEO
    index.tsx               # redireciona para /ranking
    ranking.tsx             # Aba 1
    grupos.tsx              # Aba 2
    calendario.tsx          # Aba 3
    mata-mata.tsx           # Aba 4
  components/
    layout/AppShell.tsx, TabsNav.tsx, Brand.tsx
    ranking/RankingTable.tsx, UserDetailDrawer.tsx, GuessRow.tsx
    grupos/GroupCard.tsx, ThirdPlaceTable.tsx
    calendario/MatchCard.tsx, FilterBar.tsx
    bracket/Bracket.tsx, BracketMatch.tsx
    common/FlagEmoji.tsx, StatusBadge.tsx, ScoreEditor.tsx
  data/
    teams.ts                # 48 seleções (FIFA 2026) com bandeira (emoji), grupo
    groups.ts               # grupos A–L
    fixtures.ts             # calendário fase de grupos + slots mata-mata
    participants.ts         # ~12 participantes mock + palpites por jogo
    seed.ts                 # alguns resultados reais já preenchidos
  lib/
    standings.ts            # calcula classificação dos grupos (P, SG, GP, ordem)
    thirdPlace.ts           # ranking dos 12 terceiros, top 8
    bracket2026.ts          # cruzamentos oficiais FIFA 2026 R32→Final
    scoring.ts              # pontos: 5 cheio, 2 vencedor, 0 erro (config)
    store.ts                # estado global (Zustand) + persist localStorage
  styles.css                # tokens preto/amarelo
```

## Design system (preto & amarelo)

Tokens em `src/styles.css` (`@theme` + `:root` dark-first):

- `--background` quase preto (`oklch(0.14 0 0)`)
- `--card` `oklch(0.18 0 0)`, borda sutil `oklch(0.28 0 0)`
- `--primary` amarelo vivo (`oklch(0.86 0.17 95)`) com `--primary-foreground` preto
- `--accent` amarelo âmbar para destaques (ao vivo, classificados)
- `--destructive` vermelho discreto para eliminados
- Tipografia: display `Space Grotesk` (números/títulos), corpo `Inter` — carregados via `<link>` em `__root.tsx`
- Detalhes: cantos `rounded-xl`, badges com borda amarela, "scanlines" sutis no header, números tabulares (`font-variant-numeric: tabular-nums`)

## Dados mock (FIFA 2026, 48 seleções)

- 12 grupos A–L, 4 times cada (sets plausíveis baseados no ranking)
- Fase de grupos: 6 jogos por grupo × 12 = 72 jogos
- Mata-mata: 16 (R32) + 8 (R16) + 4 (QF) + 2 (SF) + Final = 31 jogos
- ~80% dos jogos da fase de grupos com placar real preenchido para o app "fazer sentido" no carregamento; o resto editável
- 10–12 participantes com avatar (iniciais coloridas) e palpite (placar) para cada um dos 104 jogos

## Lógica

**Classificação de grupo** (`standings.ts`): ordena por Pts → SG → GP → confronto direto (simplificado).

**Ranking dos 3º** (`thirdPlace.ts`): coleta o 3º de cada grupo, ordena pelos mesmos critérios; top 8 classificados (destacados em amarelo), 4 últimos em estado "eliminado".

**Bracket FIFA 2026** (`bracket2026.ts`): tabela oficial de cruzamentos do R32 mapeando posições (ex.: `1A vs 3B/E/F`, `2C vs 2F`, …) conforme o chaveamento divulgado pela FIFA. As partidas a partir das oitavas são derivadas das vencedoras anteriores. Quando o usuário edita um placar (fase de grupos ou mata-mata), o bracket recomputa instantaneamente.

**Pontuação** (`scoring.ts`): cheio = 5, só vencedor/empate = 2, erro = 0 (constantes ajustáveis). Usado para o Ranking Geral e detalhe por jogo.

## Telas

### 1. Ranking Geral (`/ranking`)
- Tabela com colunas: # | Avatar+Nome | Cheios | Parciais | **Total** (destaque amarelo, font display)
- Top 3 com medalhas/badges; linhas hover; clique abre **Sheet lateral** (shadcn `Sheet`) com perfil + lista vertical de todos os 104 jogos: `palpite X-Y vs real X-Y` com badge "CHEIO" (amarelo), "PARCIAL" (âmbar contornado) ou "ERROU" (cinza/vermelho discreto).

### 2. Grupos (`/grupos`)
- Grid responsivo (1/2/3/4 colunas) de 12 `GroupCard` (tabela: Pos, Seleção+bandeira, P, SG, GP). 1º e 2º com fundo amarelo translúcido.
- Rodapé: **Ranking dos 3º Colocados** — tabela unificada, top 8 destacados (linha amarela com chip "CLASSIFICADO"), 4 últimos esmaecidos com chip "FORA".
- Header com botão **"Editar resultados"** (modo edição) → cada `MatchCard` da fase de grupos abre `ScoreEditor` inline; mudanças refletem em tempo real em todas as abas.

### 3. Calendário (`/calendario`)
- Timeline agrupada por data (sticky date headers).
- `MatchCard`: bandeiras grandes, nomes, horário, estádio + chip do grupo/fase, `StatusBadge` (Encerrado / AO VIVO pulsando em amarelo / Não iniciado), placar.
- `FilterBar` sticky com toggles: Fase de Grupos | Mata-Mata | Hoje | dropdown "Grupo (A–L)". Filtros combináveis.

### 4. Mata-Mata (`/mata-mata`)
- Bracket horizontal com scroll: colunas R32 → R16 → QF → SF → Final + 3º lugar.
- Cada `BracketMatch` mostra os dois times (ou placeholder "Vencedor de…") com bandeira e placar editável; vencedor propaga para a próxima rodada via `bracket2026.ts`.
- Banner topo: "Se a Copa terminasse agora 🏆 [Campeão]" com animação ao mudar.
- Mobile: bracket vira lista vertical por rodada.

## Comportamento global

- Store Zustand com `results` (Map<matchId, {home, away}>) e `participants`. `persist` middleware grava em localStorage.
- Botão **"Resetar para mock inicial"** no header (limpa storage).
- SEO: cada rota com `head()` próprio (title/description PT-BR, OG tags).
- Acessibilidade: foco visível amarelo, contraste AA, navegação por teclado nas tabs e no editor de placar.

## Fora de escopo (confirmado)

- Login / autenticação
- Backend / sincronização entre dispositivos
- Placares "ao vivo" reais (status "AO VIVO" é apenas visual em jogos marcados no mock)

## Entrega

Implementação em um único passe após aprovação, com mocks já preenchidos para o app ficar "vivo" no primeiro load.
