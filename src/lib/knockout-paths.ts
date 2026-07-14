export type KnockoutPhaseId = 2 | 3 | 4 | 5 | 6 | 7;

export type KnockoutResultSource = {
  code: string;
  result: "winner" | "loser";
};

export type KnockoutPath = {
  code: string;
  phaseId: KnockoutPhaseId;
  phase:
    | "16-avos"
    | "Oitavas"
    | "Quartas"
    | "Semifinal"
    | "Disputa de 3º"
    | "Final";
  slot: number;
  side: "left" | "right" | "center";
  label1: string;
  label2: string;
  source1?: KnockoutResultSource;
  source2?: KnockoutResultSource;
};

const winnerOf = (code: string): KnockoutResultSource => ({ code, result: "winner" });
const loserOf = (code: string): KnockoutResultSource => ({ code, result: "loser" });

export const KNOCKOUT_PHASE_ORDER = [2, 3, 4, 5, 7] as const;

export const KNOCKOUT_PATHS: readonly KnockoutPath[] = [
  { code: "M73", phaseId: 2, phase: "16-avos", slot: 0, side: "left", label1: "2º Grupo A", label2: "2º Grupo B" },
  { code: "M75", phaseId: 2, phase: "16-avos", slot: 1, side: "left", label1: "1º Grupo F", label2: "2º Grupo C" },
  { code: "M74", phaseId: 2, phase: "16-avos", slot: 2, side: "left", label1: "1º Grupo E", label2: "Melhor 3º" },
  { code: "M77", phaseId: 2, phase: "16-avos", slot: 3, side: "left", label1: "1º Grupo I", label2: "Melhor 3º" },
  { code: "M83", phaseId: 2, phase: "16-avos", slot: 4, side: "left", label1: "2º Grupo K", label2: "2º Grupo L" },
  { code: "M84", phaseId: 2, phase: "16-avos", slot: 5, side: "left", label1: "1º Grupo H", label2: "2º Grupo J" },
  { code: "M81", phaseId: 2, phase: "16-avos", slot: 6, side: "left", label1: "1º Grupo D", label2: "Melhor 3º" },
  { code: "M82", phaseId: 2, phase: "16-avos", slot: 7, side: "left", label1: "1º Grupo G", label2: "Melhor 3º" },
  { code: "M76", phaseId: 2, phase: "16-avos", slot: 8, side: "right", label1: "1º Grupo C", label2: "2º Grupo F" },
  { code: "M78", phaseId: 2, phase: "16-avos", slot: 9, side: "right", label1: "2º Grupo E", label2: "2º Grupo I" },
  { code: "M79", phaseId: 2, phase: "16-avos", slot: 10, side: "right", label1: "1º Grupo A", label2: "Melhor 3º" },
  { code: "M80", phaseId: 2, phase: "16-avos", slot: 11, side: "right", label1: "1º Grupo L", label2: "Melhor 3º" },
  { code: "M86", phaseId: 2, phase: "16-avos", slot: 12, side: "right", label1: "1º Grupo J", label2: "2º Grupo H" },
  { code: "M88", phaseId: 2, phase: "16-avos", slot: 13, side: "right", label1: "2º Grupo D", label2: "2º Grupo G" },
  { code: "M85", phaseId: 2, phase: "16-avos", slot: 14, side: "right", label1: "1º Grupo B", label2: "Melhor 3º" },
  { code: "M87", phaseId: 2, phase: "16-avos", slot: 15, side: "right", label1: "1º Grupo K", label2: "Melhor 3º" },

  { code: "M89", phaseId: 3, phase: "Oitavas", slot: 0, side: "left", label1: "Vencedor M73", label2: "Vencedor M75", source1: winnerOf("M73"), source2: winnerOf("M75") },
  { code: "M90", phaseId: 3, phase: "Oitavas", slot: 1, side: "left", label1: "Vencedor M74", label2: "Vencedor M77", source1: winnerOf("M74"), source2: winnerOf("M77") },
  { code: "M93", phaseId: 3, phase: "Oitavas", slot: 2, side: "left", label1: "Vencedor M83", label2: "Vencedor M84", source1: winnerOf("M83"), source2: winnerOf("M84") },
  { code: "M94", phaseId: 3, phase: "Oitavas", slot: 3, side: "left", label1: "Vencedor M81", label2: "Vencedor M82", source1: winnerOf("M81"), source2: winnerOf("M82") },
  { code: "M91", phaseId: 3, phase: "Oitavas", slot: 4, side: "right", label1: "Vencedor M76", label2: "Vencedor M78", source1: winnerOf("M76"), source2: winnerOf("M78") },
  { code: "M92", phaseId: 3, phase: "Oitavas", slot: 5, side: "right", label1: "Vencedor M79", label2: "Vencedor M80", source1: winnerOf("M79"), source2: winnerOf("M80") },
  { code: "M95", phaseId: 3, phase: "Oitavas", slot: 6, side: "right", label1: "Vencedor M86", label2: "Vencedor M88", source1: winnerOf("M86"), source2: winnerOf("M88") },
  { code: "M96", phaseId: 3, phase: "Oitavas", slot: 7, side: "right", label1: "Vencedor M85", label2: "Vencedor M87", source1: winnerOf("M85"), source2: winnerOf("M87") },

  { code: "M97", phaseId: 4, phase: "Quartas", slot: 0, side: "left", label1: "Vencedor M89", label2: "Vencedor M90", source1: winnerOf("M89"), source2: winnerOf("M90") },
  { code: "M98", phaseId: 4, phase: "Quartas", slot: 1, side: "left", label1: "Vencedor M93", label2: "Vencedor M94", source1: winnerOf("M93"), source2: winnerOf("M94") },
  { code: "M99", phaseId: 4, phase: "Quartas", slot: 2, side: "right", label1: "Vencedor M91", label2: "Vencedor M92", source1: winnerOf("M91"), source2: winnerOf("M92") },
  { code: "M100", phaseId: 4, phase: "Quartas", slot: 3, side: "right", label1: "Vencedor M95", label2: "Vencedor M96", source1: winnerOf("M95"), source2: winnerOf("M96") },

  { code: "M101", phaseId: 5, phase: "Semifinal", slot: 0, side: "left", label1: "Vencedor M97", label2: "Vencedor M98", source1: winnerOf("M97"), source2: winnerOf("M98") },
  { code: "M102", phaseId: 5, phase: "Semifinal", slot: 1, side: "right", label1: "Vencedor M99", label2: "Vencedor M100", source1: winnerOf("M99"), source2: winnerOf("M100") },
  { code: "M103", phaseId: 6, phase: "Disputa de 3º", slot: 0, side: "center", label1: "Perdedor M101", label2: "Perdedor M102", source1: loserOf("M101"), source2: loserOf("M102") },
  { code: "M104", phaseId: 7, phase: "Final", slot: 0, side: "center", label1: "Vencedor M101", label2: "Vencedor M102", source1: winnerOf("M101"), source2: winnerOf("M102") },
] as const;

export const KNOCKOUT_CODES_BY_PHASE = new Map<KnockoutPhaseId, string[]>(
  KNOCKOUT_PATHS.reduce<Array<[KnockoutPhaseId, string[]]>>((entries, path) => {
    const entry = entries.find(([phaseId]) => phaseId === path.phaseId);
    if (entry) entry[1].push(path.code);
    else entries.push([path.phaseId, [path.code]]);
    return entries;
  }, []),
);

const KNOCKOUT_PATH_BY_CODE = new Map(KNOCKOUT_PATHS.map((path) => [path.code, path]));

export function getKnockoutPath(code: string | null | undefined) {
  return code ? (KNOCKOUT_PATH_BY_CODE.get(code) ?? null) : null;
}

export function getKnockoutPathByPhaseSlot(phaseId: number, slot: number) {
  return (
    KNOCKOUT_PATHS.find((path) => path.phaseId === phaseId && path.slot === slot) ?? null
  );
}

export function getKnockoutCodesByPhase(phaseId: number) {
  return [...(KNOCKOUT_CODES_BY_PHASE.get(phaseId as KnockoutPhaseId) ?? [])];
}

export function getKnockoutDescendantCodes(code: string | null | undefined) {
  if (!code) return [];

  const descendants = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;

    KNOCKOUT_PATHS.forEach((path) => {
      if (descendants.has(path.code)) return;
      const dependsOnCode =
        path.source1?.code === code ||
        path.source2?.code === code ||
        (path.source1 && descendants.has(path.source1.code)) ||
        (path.source2 && descendants.has(path.source2.code));

      if (dependsOnCode) {
        descendants.add(path.code);
        changed = true;
      }
    });
  }

  return [...descendants];
}
