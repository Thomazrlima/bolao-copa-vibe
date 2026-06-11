import type { Score } from "@/data/fixtures";

export const POINTS = {
  chinelada: 10,
  strong: 7,
  result: 5,
  goals: 2,
  miss: 0,
};

export type GuessOutcome = "chinelada" | "strong" | "result" | "goals" | "miss";

export type ScoringJogo = {
  id: string;
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
};

export type ScoringPalpite = {
  user_id: string;
  jogo_id: string;
  gols1: number;
  gols2: number;
};

export type ScoringUsuario = {
  id: string;
};

export type PontuacaoJogo = {
  pontos: number;
  chinelada: boolean;
  outcome: GuessOutcome;
};

function resultSignal(gols1: number, gols2: number) {
  return Math.sign(gols1 - gols2);
}

function goalDiff(gols1: number, gols2: number) {
  return Math.abs(gols1 - gols2);
}

export function calcularPontuacaoJogo(jogo: ScoringJogo, palpite: ScoringPalpite): PontuacaoJogo {
  if (!jogo.encerrado || jogo.gols1 == null || jogo.gols2 == null || jogo.id !== palpite.jogo_id) {
    return { pontos: 0, chinelada: false, outcome: "miss" };
  }

  const acertouPlacar = palpite.gols1 === jogo.gols1 && palpite.gols2 === jogo.gols2;
  if (acertouPlacar) {
    return { pontos: POINTS.chinelada, chinelada: true, outcome: "chinelada" };
  }

  const acertouResultado =
    resultSignal(palpite.gols1, palpite.gols2) === resultSignal(jogo.gols1, jogo.gols2);
  const acertouGolDeUmTime = palpite.gols1 === jogo.gols1 || palpite.gols2 === jogo.gols2;
  const acertouDiferenca =
    goalDiff(palpite.gols1, palpite.gols2) === goalDiff(jogo.gols1, jogo.gols2);

  if (acertouResultado && (acertouGolDeUmTime || acertouDiferenca)) {
    return { pontos: POINTS.strong, chinelada: false, outcome: "strong" };
  }

  if (acertouResultado) {
    return { pontos: POINTS.result, chinelada: false, outcome: "result" };
  }

  if (acertouGolDeUmTime) {
    return { pontos: POINTS.goals, chinelada: false, outcome: "goals" };
  }

  return { pontos: POINTS.miss, chinelada: false, outcome: "miss" };
}

export function calcularPontuacaoUsuarioNoJogo(
  jogo: ScoringJogo,
  usuario: ScoringUsuario,
  palpite: ScoringPalpite | null | undefined,
): PontuacaoJogo {
  if (!palpite || palpite.user_id !== usuario.id) {
    return { pontos: 0, chinelada: false, outcome: "miss" };
  }

  return calcularPontuacaoJogo(jogo, palpite);
}

export function compareGuess(guess: Score, real: Score): GuessOutcome {
  return calcularPontuacaoJogo(
    { id: "legacy", gols1: real.home, gols2: real.away, encerrado: true },
    { user_id: "legacy", jogo_id: "legacy", gols1: guess.home, gols2: guess.away },
  ).outcome;
}

export function pointsFor(o: GuessOutcome) {
  return POINTS[o];
}
