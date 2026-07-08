import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildKnockoutBracket,
  type GrupoRow,
  type JogoGrupo,
  type KnockoutMatch,
} from "@/lib/knockout";
import { ServiceError } from "@/lib/server/bolao-service";

type FaseRow = {
  id: number;
  nome: string;
};

type JogoRow = {
  id: string;
  fase_id: number;
  codigo_mata_mata: string | null;
  time1: string;
  time2: string;
  data: string;
  gols1: number | null;
  gols2: number | null;
  penaltis1: number | null;
  penaltis2: number | null;
  vencedor: string | null;
  encerrado: boolean;
  placar_status: "upcoming" | "live" | "finished" | null;
};

type PalpiteChaveamentoRow = {
  user_id: string;
  fase_id: number;
  slot: number;
  time1: string;
  time2: string;
  vencedor: string;
  pontos: number;
  acertou: boolean | null;
  calculado_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

type InitialGameSlot = JogoRow | null;

export type ChaveamentoConfrontoInput = {
  fase_id: number;
  slot: number;
  time1: string;
  time2: string;
  vencedor: string;
};

const BRACKET_PHASE_ORDER = [2, 3, 4, 5, 7];
const NON_SCORING_PHASES = new Set([2, 6]);
const BRACKET_DEADLINE = "2026-06-29T14:00:00";
const BRACKET_CODES_BY_PHASE = new Map([
  [
    2,
    [
      "M73",
      "M75",
      "M74",
      "M77",
      "M83",
      "M84",
      "M81",
      "M82",
      "M76",
      "M78",
      "M79",
      "M80",
      "M86",
      "M88",
      "M85",
      "M87",
    ],
  ],
  [3, ["M89", "M90", "M93", "M94", "M91", "M92", "M95", "M96"]],
  [4, ["M97", "M98", "M99", "M100"]],
  [5, ["M101", "M102"]],
  [7, ["M104"]],
]);
const EXPECTED_INITIAL_MATCHES_BY_PHASE = new Map([
  [2, 16],
  [3, 8],
  [4, 4],
  [5, 2],
  [7, 1],
]);

function assertNoError(error: { message: string } | null | undefined) {
  if (error) throw new ServiceError(error.message);
}

function nowAsStoredBrasiliaMs() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return Date.parse(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`,
  );
}

function storedBrasiliaMs(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return Date.parse(value);

  const [, year, month, day, hour, minute, second = "00"] = match;
  return Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`);
}

function cleanTeamName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isConcreteTeamName(value: string | null | undefined) {
  const team = cleanTeamName(value);
  if (!team) return false;
  return !/^(a definir|tbd|vencedor|perdedor|melhor\s+3|[123]º?\s+grupo)/i.test(team);
}

function matchKey(faseId: number, slot: number) {
  return `${faseId}:${slot}`;
}

function expectedBracketCode(faseId: number, slot: number) {
  return BRACKET_CODES_BY_PHASE.get(faseId)?.[slot] ?? null;
}

function normalizeKnockoutCode(value: string | null | undefined) {
  const code = value?.trim().toUpperCase();
  return code && /^M\d+$/.test(code) ? code : null;
}

function buildPhasePlan(
  initialPhaseId: number,
  initialMatchCount: number,
  phaseById: Map<number, string>,
) {
  const phases = [];
  let count = initialMatchCount;

  for (const faseId of BRACKET_PHASE_ORDER.filter((id) => id >= initialPhaseId)) {
    if (count < 1) break;
    phases.push({
      fase_id: faseId,
      nome: phaseById.get(faseId) ?? `Fase ${faseId}`,
      total_confrontos: count,
      pontuavel: !NON_SCORING_PHASES.has(faseId),
    });
    count = Math.floor(count / 2);
  }

  return phases;
}

function buildSavedByKey(rows: PalpiteChaveamentoRow[]) {
  return new Map(rows.map((row) => [matchKey(row.fase_id, row.slot), row]));
}

function teamPairKey(time1: string | null | undefined, time2: string | null | undefined) {
  const first = cleanTeamName(time1);
  const second = cleanTeamName(time2);
  if (!first || !second) return null;

  return [first, second].sort((a, b) => a.localeCompare(b, "pt-BR")).join("::");
}

function savedTeamPairKey(
  faseId: number,
  time1: string | null | undefined,
  time2: string | null | undefined,
) {
  const pairKey = teamPairKey(time1, time2);
  return pairKey ? `${faseId}:${pairKey}` : null;
}

function buildSavedByTeamPair(rows: PalpiteChaveamentoRow[]) {
  const savedByTeamPair = new Map<string, PalpiteChaveamentoRow>();

  rows.forEach((row) => {
    const key = savedTeamPairKey(row.fase_id, row.time1, row.time2);
    if (key) savedByTeamPair.set(key, row);
  });

  return savedByTeamPair;
}

function savedMatchFitsTeams(
  savedMatch: PalpiteChaveamentoRow | undefined,
  time1: string | null | undefined,
  time2: string | null | undefined,
) {
  if (!savedMatch) return false;

  const expectedTeamPair = teamPairKey(time1, time2);
  if (!expectedTeamPair) return true;

  return teamPairKey(savedMatch.time1, savedMatch.time2) === expectedTeamPair;
}

function finishedGroups(groups: GrupoRow[], games: JogoRow[]) {
  const groupTeams = new Map<string, Set<string>>();
  groups.forEach((group) => {
    const teams = groupTeams.get(group.grupo) ?? new Set<string>();
    teams.add(group.time);
    groupTeams.set(group.grupo, teams);
  });

  return new Set(
    [...groupTeams.entries()].flatMap(([group, teams]) => {
      const groupGames = games.filter((game) => teams.has(game.time1) && teams.has(game.time2));
      const finished =
        groupGames.length > 0 &&
        groupGames.every((game) => game.encerrado || game.placar_status === "finished");

      return finished ? [group] : [];
    }),
  );
}

function labelGroups(label: string) {
  return [...label.matchAll(/Grupo\s+([A-L])/gi)].map((match) => match[1].toUpperCase());
}

function projectedMatchIsDefined(
  match: ReturnType<typeof buildKnockoutBracket>["r32"][number],
  completedGroups: Set<string>,
  allGroupsFinished: boolean,
) {
  if (!match.time1 || !match.time2) return false;
  if (/melhor\s+3/i.test(`${match.label1} ${match.label2}`)) return allGroupsFinished;

  const requiredGroups = [...labelGroups(match.label1), ...labelGroups(match.label2)];
  return requiredGroups.length > 0 && requiredGroups.every((group) => completedGroups.has(group));
}

async function loadChaveamentoContext(supabase: SupabaseClient, userId: string) {
  const [gamesResult, phasesResult, savedResult, groupsResult] = await Promise.all([
    supabase
      .from("jogos")
      .select(
        "id,fase_id,codigo_mata_mata,time1,time2,data,gols1,gols2,penaltis1,penaltis2,vencedor,encerrado,placar_status",
      )
      .order("fase_id", { ascending: true })
      .order("codigo_mata_mata", { ascending: true, nullsFirst: false })
      .order("data", { ascending: true }),
    supabase.from("fases").select("id,nome"),
    supabase
      .from("palpites_chaveamento")
      .select(
        "user_id,fase_id,slot,time1,time2,vencedor,pontos,acertou,calculado_em,criado_em,atualizado_em",
      )
      .eq("user_id", userId)
      .order("fase_id", { ascending: true })
      .order("slot", { ascending: true }),
    supabase
      .from("grupos")
      .select("grupo,time,pontuacao,saldo_gols,gols_pro,gols_contra")
      .order("grupo", { ascending: true }),
  ]);

  assertNoError(gamesResult.error);
  assertNoError(phasesResult.error);
  assertNoError(savedResult.error);
  assertNoError(groupsResult.error);

  const games = (gamesResult.data ?? []) as JogoRow[];
  const phases = (phasesResult.data ?? []) as FaseRow[];
  const saved = (savedResult.data ?? []) as PalpiteChaveamentoRow[];
  const groups = (groupsResult.data ?? []) as GrupoRow[];

  return { games, phases, saved, groups };
}

function buildProjectedInitialGames(groups: GrupoRow[], games: JogoRow[]): InitialGameSlot[] {
  const groupGames = games.filter((game) => game.fase_id === 1);
  const completedGroups = finishedGroups(groups, groupGames);
  const allGroupsFinished =
    completedGroups.size >= new Set(groups.map((group) => group.grupo)).size;
  const bracket = buildKnockoutBracket(groups, groupGames as JogoGrupo[]);
  const matchesByCode = new Map(bracket.r32.map((match) => [match.id, match]));

  return (BRACKET_CODES_BY_PHASE.get(2) ?? []).map((code) => {
    const match = matchesByCode.get(code);
    if (!match) return null;
    if (!projectedMatchIsDefined(match, completedGroups, allGroupsFinished)) return null;
    if (!match.time1 || !match.time2) return null;

    return {
      id: match.id,
      fase_id: 2,
      codigo_mata_mata: match.id,
      time1: match.time1.time,
      time2: match.time2.time,
      data: "",
      gols1: null,
      gols2: null,
      penaltis1: null,
      penaltis2: null,
      vencedor: null,
      encerrado: false,
      placar_status: "upcoming" as const,
    };
  });
}

function buildCanonicalInitialGames(
  groups: GrupoRow[],
  games: JogoRow[],
  phaseId: number,
  concreteKnockoutGames: JogoRow[],
): InitialGameSlot[] {
  const bracket = buildKnockoutBracket(groups, games as JogoGrupo[]);
  const matches = bracketMatchesByPhase(bracket, phaseId);
  if (!matches.length) return [];

  const gamesByCode = new Map(
    concreteKnockoutGames
      .filter((game) => game.fase_id === phaseId)
      .flatMap((game) => {
        const code = normalizeKnockoutCode(game.codigo_mata_mata);
        return code ? [[code, game] as const] : [];
      }),
  );
  const gamesByTeamPair = new Map(
    concreteKnockoutGames
      .filter((game) => game.fase_id === phaseId)
      .flatMap((game) => {
        const key = savedTeamPairKey(game.fase_id, game.time1, game.time2);
        return key ? [[key, game] as const] : [];
      }),
  );

  return matches.map((match) => {
    const time1 = match.time1?.time ?? null;
    const time2 = match.time2?.time ?? null;
    const teamPairKey = savedTeamPairKey(phaseId, time1, time2);
    const officialGame =
      gamesByCode.get(match.id) ?? (teamPairKey ? gamesByTeamPair.get(teamPairKey) : undefined);

    if (officialGame) {
      if (!time1 || !time2) return officialGame;

      return {
        ...officialGame,
        codigo_mata_mata: match.id,
        time1,
        time2,
        gols1: scoreForTeam(officialGame, time1, "gols"),
        gols2: scoreForTeam(officialGame, time2, "gols"),
        penaltis1: scoreForTeam(officialGame, time1, "penaltis"),
        penaltis2: scoreForTeam(officialGame, time2, "penaltis"),
        vencedor: winnerForCanonicalOrder(officialGame, time1, time2),
      };
    }

    if (!time1 || !time2) return null;

    return {
      id: match.jogoId ?? match.id,
      fase_id: phaseId,
      codigo_mata_mata: match.id,
      time1,
      time2,
      data: match.data ?? "",
      gols1: match.gols1 ?? null,
      gols2: match.gols2 ?? null,
      penaltis1: match.penaltis1 ?? null,
      penaltis2: match.penaltis2 ?? null,
      vencedor: match.winnerName ?? null,
      encerrado: match.encerrado ?? false,
      placar_status: match.placar_status ?? "upcoming",
    };
  });
}

function scoreForTeam(game: JogoRow, team: string | null | undefined, field: "gols" | "penaltis") {
  const name = cleanTeamName(team);
  if (!name) return null;

  if (name === cleanTeamName(game.time1)) {
    return field === "gols" ? game.gols1 : game.penaltis1;
  }

  if (name === cleanTeamName(game.time2)) {
    return field === "gols" ? game.gols2 : game.penaltis2;
  }

  return null;
}

function winnerForCanonicalOrder(game: JogoRow, time1: string, time2: string) {
  const winner = cleanTeamName(game.vencedor);
  if (winner === time1 || winner === time2) return winner;
  if (!game.encerrado || game.gols1 == null || game.gols2 == null) return null;

  const gols1 = scoreForTeam(game, time1, "gols");
  const gols2 = scoreForTeam(game, time2, "gols");
  if (gols1 != null && gols2 != null && gols1 !== gols2) return gols1 > gols2 ? time1 : time2;

  const penaltis1 = scoreForTeam(game, time1, "penaltis");
  const penaltis2 = scoreForTeam(game, time2, "penaltis");
  if (penaltis1 != null && penaltis2 != null && penaltis1 !== penaltis2) {
    return penaltis1 > penaltis2 ? time1 : time2;
  }

  return null;
}

function bracketMatchesByPhase(
  bracket: ReturnType<typeof buildKnockoutBracket>,
  phaseId: number,
): KnockoutMatch[] {
  switch (phaseId) {
    case 2:
      return bracket.r32;
    case 3:
      return bracket.r16;
    case 4:
      return bracket.quartas;
    case 5:
      return bracket.semifinais;
    case 7:
      return [bracket.final];
    default:
      return [];
  }
}

function buildChaveamentoPayload(
  games: JogoRow[],
  phases: FaseRow[],
  saved: PalpiteChaveamentoRow[],
  groups: GrupoRow[],
) {
  const phaseById = new Map(phases.map((phase) => [phase.id, phase.nome]));
  const concreteKnockoutGames = games.filter(
    (game) =>
      game.fase_id > 1 &&
      game.fase_id !== 6 &&
      isConcreteTeamName(game.time1) &&
      isConcreteTeamName(game.time2),
  );
  const initialPhaseId = Math.min(...concreteKnockoutGames.map((game) => game.fase_id));
  const hasInitialPhase = Number.isFinite(initialPhaseId);
  const officialInitialGames = hasInitialPhase
    ? buildCanonicalInitialGames(groups, games, initialPhaseId, concreteKnockoutGames)
    : [];
  const projectedInitialGames = buildProjectedInitialGames(groups, games);
  const initialGames =
    officialInitialGames.length > 0 ? officialInitialGames : projectedInitialGames;
  const definedInitialGames = initialGames.filter((game): game is JogoRow => Boolean(game));
  const effectiveInitialPhaseId = officialInitialGames.length > 0 ? initialPhaseId : 2;
  const expectedInitialMatches =
    EXPECTED_INITIAL_MATCHES_BY_PHASE.get(effectiveInitialPhaseId) ?? definedInitialGames.length;
  const visualInitialMatchCount = Math.max(initialGames.length, expectedInitialMatches);
  const phasesPlan = buildPhasePlan(effectiveInitialPhaseId, visualInitialMatchCount, phaseById);
  const deadline = BRACKET_DEADLINE;
  const available = definedInitialGames.length > 0 || phasesPlan.length > 0;
  const open = Boolean(available && storedBrasiliaMs(deadline) > nowAsStoredBrasiliaMs());
  const savedByKey = buildSavedByKey(saved);
  const savedByTeamPair = buildSavedByTeamPair(saved);
  const totalPontuavel = phasesPlan
    .filter((phase) => phase.pontuavel)
    .reduce((sum, phase) => sum + phase.total_confrontos, 0);
  let previousWinners: Array<string | null> = [];
  const fases = phasesPlan.map((phase, phaseIndex) => {
    const confrontos = Array.from({ length: phase.total_confrontos }, (_, slot) => {
      const initialGame =
        phase.fase_id === phasesPlan[0]?.fase_id ? initialGames[slot] : (null as JogoRow | null);
      const generatedTime1 = phaseIndex > 0 ? (previousWinners[slot * 2] ?? null) : null;
      const generatedTime2 = phaseIndex > 0 ? (previousWinners[slot * 2 + 1] ?? null) : null;
      const plannedTime1 = initialGame?.time1 ?? generatedTime1;
      const plannedTime2 = initialGame?.time2 ?? generatedTime2;
      const savedByPlannedPairKey = savedTeamPairKey(phase.fase_id, plannedTime1, plannedTime2);
      const savedByPlannedPair = savedByPlannedPairKey
        ? savedByTeamPair.get(savedByPlannedPairKey)
        : undefined;
      const savedBySlot = savedByKey.get(matchKey(phase.fase_id, slot));
      const savedMatch =
        savedByPlannedPair ??
        (savedMatchFitsTeams(savedBySlot, plannedTime1, plannedTime2) ? savedBySlot : undefined);
      const time1 = plannedTime1 ?? savedMatch?.time1 ?? null;
      const time2 = plannedTime2 ?? savedMatch?.time2 ?? null;
      const vencedor =
        savedMatch?.vencedor === time1 || savedMatch?.vencedor === time2
          ? savedMatch.vencedor
          : null;

      return {
        fase_id: phase.fase_id,
        fase: phase.nome,
        codigo_mata_mata: initialGame?.codigo_mata_mata ?? expectedBracketCode(phase.fase_id, slot),
        slot,
        time1,
        time2,
        vencedor,
        pontos: Number(savedMatch?.pontos ?? 0),
        acertou: savedMatch?.acertou ?? null,
        calculado_em: savedMatch?.calculado_em ?? null,
      };
    });

    previousWinners = confrontos.map((match) => match.vencedor);
    return { ...phase, confrontos };
  });

  return {
    disponivel: available,
    aberto: open,
    prazo_envio: deadline,
    inicial_fase_id: phasesPlan.length > 0 ? phasesPlan[0].fase_id : null,
    salvo: saved.length > 0,
    completo: phasesPlan.reduce((sum, phase) => sum + phase.total_confrontos, 0) === saved.length,
    pontos: saved.reduce((sum, row) => sum + Number(row.pontos ?? 0), 0),
    acertos: saved.filter((row) => row.acertou).length,
    total_pontuavel: totalPontuavel,
    fases,
  };
}

export async function getPalpiteChaveamento(supabase: SupabaseClient, userId: string) {
  const context = await loadChaveamentoContext(supabase, userId);

  return buildChaveamentoPayload(context.games, context.phases, context.saved, context.groups);
}

export async function salvarPalpiteChaveamento(
  supabase: SupabaseClient,
  userId: string,
  confrontos: ChaveamentoConfrontoInput[],
) {
  const context = await loadChaveamentoContext(supabase, userId);
  const currentPayload = buildChaveamentoPayload(
    context.games,
    context.phases,
    context.saved,
    context.groups,
  );

  if (!currentPayload.disponivel) {
    throw new ServiceError("O chaveamento ainda nÃ£o estÃ¡ disponÃ­vel.", 409);
  }

  if (!currentPayload.aberto) {
    throw new ServiceError("O prazo para enviar o chaveamento jÃ¡ encerrou.", 409);
  }

  const expected = new Map<string, { fase_id: number; slot: number }>();
  currentPayload.fases.forEach((phase) => {
    phase.confrontos.forEach((match) => {
      expected.set(matchKey(match.fase_id, match.slot), {
        fase_id: match.fase_id,
        slot: match.slot,
      });
    });
  });

  if (confrontos.length < 1) {
    throw new ServiceError("Escolha pelo menos um confronto antes de salvar.", 400);
  }

  const normalized = confrontos.map((match) => ({
    fase_id: Number(match.fase_id),
    slot: Number(match.slot),
    time1: cleanTeamName(match.time1),
    time2: cleanTeamName(match.time2),
    vencedor: cleanTeamName(match.vencedor),
  }));
  const submittedKeys = new Set<string>();

  for (const match of normalized) {
    const key = matchKey(match.fase_id, match.slot);
    const expectedMatch = expected.get(key);
    if (!expectedMatch || !match.time1 || !match.time2 || !match.vencedor) {
      throw new ServiceError("HÃ¡ confrontos incompletos no chaveamento.", 400);
    }

    if (submittedKeys.has(key)) {
      throw new ServiceError("HÃ¡ confrontos duplicados no chaveamento.", 400);
    }
    submittedKeys.add(key);

    if (
      match.time1 === match.time2 ||
      (match.vencedor !== match.time1 && match.vencedor !== match.time2)
    ) {
      throw new ServiceError("Escolha um vencedor vÃ¡lido para cada confronto.", 400);
    }
  }

  const initialPhase = currentPayload.inicial_fase_id;
  const initialBySlot = new Map(
    currentPayload.fases
      .find((phase) => phase.fase_id === initialPhase)
      ?.confrontos.map((match) => [match.slot, match]) ?? [],
  );

  for (const match of normalized.filter((item) => item.fase_id === initialPhase)) {
    const initialMatch = initialBySlot.get(match.slot);
    const expectedTeams = [initialMatch?.time1, initialMatch?.time2].sort().join("::");
    const submittedTeams = [match.time1, match.time2].sort().join("::");
    if (expectedTeams !== submittedTeams) {
      throw new ServiceError("O chaveamento inicial nÃ£o confere com os confrontos oficiais.", 400);
    }
  }

  const deleteResult = await supabase.from("palpites_chaveamento").delete().eq("user_id", userId);
  assertNoError(deleteResult.error);

  const insertRows = normalized.map((match) => ({
    user_id: userId,
    fase_id: match.fase_id,
    slot: match.slot,
    time1: match.time1!,
    time2: match.time2!,
    vencedor: match.vencedor!,
  }));
  const insertResult = await supabase.from("palpites_chaveamento").insert(insertRows);
  assertNoError(insertResult.error);

  return getPalpiteChaveamento(supabase, userId);
}
