import type { SupabaseClient } from "@supabase/supabase-js";

import { ServiceError } from "@/lib/server/bolao-service";

type FaseRow = {
  id: number;
  nome: string;
};

type JogoRow = {
  id: string;
  fase_id: number;
  time1: string;
  time2: string;
  data: string;
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

export type ChaveamentoConfrontoInput = {
  fase_id: number;
  slot: number;
  time1: string;
  time2: string;
  vencedor: string;
};

const BRACKET_PHASE_ORDER = [2, 3, 4, 5, 7];
const NON_SCORING_PHASES = new Set([2, 6]);

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

function sortGamesByBracketSlot(a: JogoRow, b: JogoRow) {
  return (
    a.data.localeCompare(b.data) ||
    a.time1.localeCompare(b.time1, "pt-BR") ||
    a.time2.localeCompare(b.time2, "pt-BR")
  );
}

function buildPhasePlan(initialPhaseId: number, initialMatchCount: number, phaseById: Map<number, string>) {
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

async function loadChaveamentoContext(supabase: SupabaseClient, userId: string) {
  const [gamesResult, phasesResult, savedResult] = await Promise.all([
    supabase
      .from("jogos")
      .select("id,fase_id,time1,time2,data,encerrado,placar_status")
      .order("fase_id", { ascending: true })
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
  ]);

  assertNoError(gamesResult.error);
  assertNoError(phasesResult.error);
  assertNoError(savedResult.error);

  const games = (gamesResult.data ?? []) as JogoRow[];
  const phases = (phasesResult.data ?? []) as FaseRow[];
  const saved = (savedResult.data ?? []) as PalpiteChaveamentoRow[];

  return { games, phases, saved };
}

function buildChaveamentoPayload(
  games: JogoRow[],
  phases: FaseRow[],
  saved: PalpiteChaveamentoRow[],
) {
  const phaseById = new Map(phases.map((phase) => [phase.id, phase.nome]));
  const groupGames = games.filter((game) => game.fase_id === 1);
  const groupsFinished =
    groupGames.length > 0 &&
    groupGames.every((game) => game.encerrado || game.placar_status === "finished");
  const concreteKnockoutGames = games.filter(
    (game) =>
      game.fase_id > 1 &&
      game.fase_id !== 6 &&
      isConcreteTeamName(game.time1) &&
      isConcreteTeamName(game.time2),
  );
  const initialPhaseId = Math.min(...concreteKnockoutGames.map((game) => game.fase_id));
  const hasInitialPhase = Number.isFinite(initialPhaseId);
  const initialGames = hasInitialPhase
    ? concreteKnockoutGames
        .filter((game) => game.fase_id === initialPhaseId)
        .sort(sortGamesByBracketSlot)
    : [];
  const phasesPlan = hasInitialPhase
    ? buildPhasePlan(initialPhaseId, initialGames.length, phaseById)
    : [];
  const deadline = initialGames[0]?.data ?? null;
  const available = groupsFinished && initialGames.length >= 2;
  const open = Boolean(available && deadline && Date.parse(deadline) > nowAsStoredBrasiliaMs());
  const savedByKey = buildSavedByKey(saved);
  const totalPontuavel = phasesPlan
    .filter((phase) => phase.pontuavel)
    .reduce((sum, phase) => sum + phase.total_confrontos, 0);

  return {
    disponivel: available,
    aberto: open,
    prazo_envio: deadline,
    inicial_fase_id: hasInitialPhase ? initialPhaseId : null,
    salvo: saved.length > 0,
    completo: phasesPlan.reduce((sum, phase) => sum + phase.total_confrontos, 0) === saved.length,
    pontos: saved.reduce((sum, row) => sum + Number(row.pontos ?? 0), 0),
    acertos: saved.filter((row) => row.acertou).length,
    total_pontuavel: totalPontuavel,
    fases: phasesPlan.map((phase) => ({
      ...phase,
      confrontos: Array.from({ length: phase.total_confrontos }, (_, slot) => {
        const initialGame =
          phase.fase_id === initialPhaseId ? initialGames[slot] : (null as JogoRow | null);
        const savedMatch = savedByKey.get(matchKey(phase.fase_id, slot));

        return {
          fase_id: phase.fase_id,
          fase: phase.nome,
          slot,
          time1: savedMatch?.time1 ?? initialGame?.time1 ?? null,
          time2: savedMatch?.time2 ?? initialGame?.time2 ?? null,
          vencedor: savedMatch?.vencedor ?? null,
          pontos: Number(savedMatch?.pontos ?? 0),
          acertou: savedMatch?.acertou ?? null,
          calculado_em: savedMatch?.calculado_em ?? null,
        };
      }),
    })),
  };
}

export async function getPalpiteChaveamento(supabase: SupabaseClient, userId: string) {
  let context = await loadChaveamentoContext(supabase, userId);

  if (context.saved.length > 0) {
    const recalcResult = await supabase.rpc("recalcular_pontuacao_chaveamento");
    assertNoError(recalcResult.error);
    context = await loadChaveamentoContext(supabase, userId);
  }

  return buildChaveamentoPayload(context.games, context.phases, context.saved);
}

export async function salvarPalpiteChaveamento(
  supabase: SupabaseClient,
  userId: string,
  confrontos: ChaveamentoConfrontoInput[],
) {
  const context = await loadChaveamentoContext(supabase, userId);
  const currentPayload = buildChaveamentoPayload(context.games, context.phases, context.saved);

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

  if (confrontos.length !== expected.size) {
    throw new ServiceError("Preencha o chaveamento completo antes de salvar.", 400);
  }

  const normalized = confrontos.map((match) => ({
    fase_id: Number(match.fase_id),
    slot: Number(match.slot),
    time1: cleanTeamName(match.time1),
    time2: cleanTeamName(match.time2),
    vencedor: cleanTeamName(match.vencedor),
  }));

  for (const match of normalized) {
    const expectedMatch = expected.get(matchKey(match.fase_id, match.slot));
    if (!expectedMatch || !match.time1 || !match.time2 || !match.vencedor) {
      throw new ServiceError("HÃ¡ confrontos incompletos no chaveamento.", 400);
    }

    if (match.time1 === match.time2 || (match.vencedor !== match.time1 && match.vencedor !== match.time2)) {
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

  const recalcResult = await supabase.rpc("recalcular_pontuacao_chaveamento");
  assertNoError(recalcResult.error);

  return getPalpiteChaveamento(supabase, userId);
}
