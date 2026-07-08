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
  fase_id?: number | null;
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

const PHASE_POINT_MULTIPLIERS: Record<number, number> = {
  2: 1.2,
  3: 1.4,
  4: 2,
  5: 3,
  7: 4,
};

export function getPhasePointMultiplier(faseId: number | null | undefined) {
  return faseId == null ? 1 : (PHASE_POINT_MULTIPLIERS[faseId] ?? 1);
}

export function getPhaseAdjustedPoints(basePoints: number, faseId: number | null | undefined) {
  return Math.floor(basePoints * getPhasePointMultiplier(faseId));
}

function resultSignal(gols1: number, gols2: number) {
  return Math.sign(gols1 - gols2);
}

function goalDiff(gols1: number, gols2: number) {
  return Math.abs(gols1 - gols2);
}

function buildScore(outcome: GuessOutcome, chinelada: boolean, faseId: number | null | undefined) {
  return {
    pontos: getPhaseAdjustedPoints(POINTS[outcome], faseId),
    chinelada,
    outcome,
  };
}

export function calcularPontuacaoJogo(jogo: ScoringJogo, palpite: ScoringPalpite): PontuacaoJogo {
  if (!jogo.encerrado || jogo.gols1 == null || jogo.gols2 == null || jogo.id !== palpite.jogo_id) {
    return buildScore("miss", false, jogo.fase_id);
  }

  const acertouPlacar = palpite.gols1 === jogo.gols1 && palpite.gols2 === jogo.gols2;
  if (acertouPlacar) {
    return buildScore("chinelada", true, jogo.fase_id);
  }

  const acertouResultado =
    resultSignal(palpite.gols1, palpite.gols2) === resultSignal(jogo.gols1, jogo.gols2);
  const acertouGolDeUmTime = palpite.gols1 === jogo.gols1 || palpite.gols2 === jogo.gols2;
  const acertouDiferenca =
    goalDiff(palpite.gols1, palpite.gols2) === goalDiff(jogo.gols1, jogo.gols2);

  if (acertouResultado && (acertouGolDeUmTime || acertouDiferenca)) {
    return buildScore("strong", false, jogo.fase_id);
  }

  if (acertouResultado) {
    return buildScore("result", false, jogo.fase_id);
  }

  if (acertouGolDeUmTime) {
    return buildScore("goals", false, jogo.fase_id);
  }

  return buildScore("miss", false, jogo.fase_id);
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
