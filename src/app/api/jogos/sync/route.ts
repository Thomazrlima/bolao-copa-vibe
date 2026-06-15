import { NextResponse } from "next/server";

import { teamCodeFromName } from "@/data/iso2";
import { createAdminClient, hasAdminCredentials } from "@/lib/supabase/admin";
import {
  lookupSportsDbEventStatisticsWithRaw,
  lookupSportsDbScoreWithRaw,
  lookupSportsDbTeamPlayers,
  type SportsDbEventStatistic,
  type SportsDbScore,
  type SportsDbTeamPlayer,
} from "@/lib/thesportsdb";

type JogoSync = {
  id: string;
  sportsdb_event_id: string | null;
  time1: string;
  time2: string;
  data: string;
  encerrado: boolean;
  estatisticas: SportsDbEventStatistic[] | null;
};

type SyncDiagnostic = {
  jogo_id: string;
  evento_id: string;
  jogo: string;
  tipo: "placar" | "estatisticas" | "selecoes" | "convocados";
  consultado_em: string;
  interpretado: unknown;
  resposta: unknown;
  erro?: string;
};

type SyncSummary = {
  jogos_elegiveis: number;
  jogos_sincronizados: number;
  jogos_encerrados: number;
  estatisticas_sincronizadas: number;
  selecoes_mapeadas: number;
  convocados_sincronizados: number;
  provedores: {
    thesportsdb: number;
  };
};

type SportsDbSelectionCandidate = {
  codigo: string;
  nome: string;
  sportsdb_team_id: string;
  sportsdb_team_name: string | null;
};

type SportsDbSelectionCacheRow = SportsDbSelectionCandidate & {
  jogadores: SportsDbTeamPlayer[] | null;
  sincronizado_em: string | null;
};

const MAX_THESPORTSDB_REQUESTS_PER_SYNC = 15;
const SELECTION_MAPPING_BACKFILL_LIMIT = 6;
const PLAYERS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET não está configurado." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { error: "A credencial administrativa do Supabase não está configurada." },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  const supabase = createAdminClient();
  const lockResult = await supabase.rpc("tentar_iniciar_sync_jogos", {
    p_lock_segundos: 90,
  });

  if (lockResult.error) {
    return NextResponse.json(
      { error: `Não foi possível adquirir o lock: ${lockResult.error.message}` },
      { status: 500 },
    );
  }

  if (!lockResult.data) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "sync_em_andamento" },
      { status: 202 },
    );
  }

  let summary: SyncSummary = {
    jogos_elegiveis: 0,
    jogos_sincronizados: 0,
    jogos_encerrados: 0,
    estatisticas_sincronizadas: 0,
    selecoes_mapeadas: 0,
    convocados_sincronizados: 0,
    provedores: { thesportsdb: 0 },
  };
  let syncError: string | null = null;
  const diagnostics: SyncDiagnostic[] = [];
  const executionResult = await supabase
    .from("sync_jogos_execucoes")
    .insert({ iniciado_em: new Date(startedAt).toISOString() })
    .select("id")
    .maybeSingle();

  if (executionResult.error || !executionResult.data?.id) {
    const historyError =
      executionResult.error?.message ?? "A execução foi criada sem um identificador.";
    await supabase.rpc("finalizar_sync_jogos", {
      p_sucesso: false,
      p_erro: `Falha ao iniciar o diagnóstico: ${historyError}`,
      p_jogos_elegiveis: 0,
      p_jogos_sincronizados: 0,
      p_duracao_ms: Date.now() - startedAt,
    });

    return NextResponse.json(
      { error: `Não foi possível iniciar o diagnóstico do sync: ${historyError}` },
      { status: 500 },
    );
  }

  const executionId = executionResult.data.id;

  try {
    summary = await synchronizeGames(supabase, diagnostics);
  } catch (error) {
    syncError = error instanceof Error ? error.message : "Erro desconhecido ao sincronizar jogos.";
  }

  const durationMs = Date.now() - startedAt;
  const finalizeResult = await supabase.rpc("finalizar_sync_jogos", {
    p_sucesso: syncError == null,
    p_erro: syncError,
    p_jogos_elegiveis: summary.jogos_elegiveis,
    p_jogos_sincronizados: summary.jogos_sincronizados,
    p_duracao_ms: durationMs,
  });

  if (finalizeResult.error) {
    return NextResponse.json(
      { error: `Não foi possível finalizar o sync: ${finalizeResult.error.message}` },
      { status: 500 },
    );
  }

  const historyResult = await supabase
    .from("sync_jogos_execucoes")
    .update({
      finalizado_em: new Date().toISOString(),
      sucesso: syncError == null,
      erro: syncError,
      duracao_ms: durationMs,
      resumo: summary,
      diagnosticos: diagnostics,
    })
    .eq("id", executionId);

  if (historyResult.error) {
    await supabase.rpc("finalizar_sync_jogos", {
      p_sucesso: false,
      p_erro: `O sync executou, mas o diagnóstico não foi salvo: ${historyResult.error.message}`,
      p_jogos_elegiveis: summary.jogos_elegiveis,
      p_jogos_sincronizados: summary.jogos_sincronizados,
      p_duracao_ms: durationMs,
    });

    return NextResponse.json(
      { error: `O sync executou, mas o diagnóstico não foi salvo: ${historyResult.error.message}` },
      { status: 500 },
    );
  }

  await supabase
    .from("sync_jogos_execucoes")
    .delete()
    .lt("iniciado_em", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (syncError) {
    return NextResponse.json(
      {
        ok: false,
        error: syncError,
        duracao_ms: durationMs,
        ...summary,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    iniciado_em: new Date(startedAt).toISOString(),
    finalizado_em: new Date().toISOString(),
    duracao_ms: durationMs,
    ...summary,
  });
}

async function synchronizeGames(
  supabase: ReturnType<typeof createAdminClient>,
  diagnostics: SyncDiagnostic[],
) {
  const nowIso = nowAsStoredBrasiliaIso();
  const activeResult = await supabase
    .from("jogos")
    .select("id,sportsdb_event_id,time1,time2,data,encerrado,estatisticas")
    .lte("data", nowIso)
    .eq("encerrado", false)
    .not("sportsdb_event_id", "is", null)
    .order("data", { ascending: true })
    .limit(7);

  if (activeResult.error) throw new Error(activeResult.error.message);

  // O cron roda duas vezes por minuto e a chave gratuita permite 30 chamadas/minuto.
  const remainingRequests = Math.max(0, 15 - (activeResult.data?.length ?? 0) * 2);
  const finishedLimit = Math.min(5, remainingRequests);
  const finishedResult =
    finishedLimit > 0
      ? await supabase
          .from("jogos")
          .select("id,sportsdb_event_id,time1,time2,data,encerrado,estatisticas")
          .eq("encerrado", true)
          .is("estatisticas", null)
          .not("sportsdb_event_id", "is", null)
          .order("data", { ascending: false })
          .limit(finishedLimit)
      : { data: [], error: null };

  if (finishedResult.error) throw new Error(finishedResult.error.message);

  const activeJogos = (activeResult.data ?? []) as JogoSync[];
  const finishedJogos = (finishedResult.data ?? []) as JogoSync[];
  const summary: SyncSummary = {
    jogos_elegiveis: activeJogos.length + finishedJogos.length,
    jogos_sincronizados: 0,
    jogos_encerrados: 0,
    estatisticas_sincronizadas: 0,
    selecoes_mapeadas: 0,
    convocados_sincronizados: 0,
    provedores: { thesportsdb: 0 },
  };
  const mappedSelections = new Map<string, SportsDbSelectionCandidate>();

  for (const jogo of activeJogos) {
    if (!jogo.sportsdb_event_id) continue;

    let scoreLookup;
    try {
      scoreLookup = await lookupSportsDbScoreWithRaw(jogo.sportsdb_event_id);
    } catch (error) {
      diagnostics.push(createDiagnostic(jogo, "placar", null, null, errorMessage(error)));
      throw error;
    }

    const score = scoreLookup.data;
    diagnostics.push(createDiagnostic(jogo, "placar", score, scoreLookup.raw));
    if (!score) continue;

    const { error: updateError } = await supabase.rpc("atualizar_placar_jogo_sportsdb", {
      p_sportsdb_event_id: score.eventId,
      p_gols1: score.gols1,
      p_gols2: score.gols2,
      p_encerrado: score.encerrado,
      p_status: score.status,
    });

    if (updateError) throw new Error(updateError.message);

    summary.jogos_sincronizados += 1;
    summary.provedores.thesportsdb += 1;
    if (score.encerrado) summary.jogos_encerrados += 1;

    await mapSportsDbSelections(supabase, jogo, score, summary, mappedSelections);
    await synchronizeStatistics(supabase, jogo, summary, diagnostics);
  }

  for (const jogo of finishedJogos) {
    await synchronizeStatistics(supabase, jogo, summary, diagnostics);
  }

  await synchronizeSelectionMappings(supabase, summary, mappedSelections, diagnostics);
  await synchronizeSelectionPlayers(supabase, [...mappedSelections.values()], summary, diagnostics);

  return summary;
}

async function synchronizeSelectionMappings(
  supabase: ReturnType<typeof createAdminClient>,
  summary: SyncSummary,
  mappedSelections: Map<string, SportsDbSelectionCandidate>,
  diagnostics: SyncDiagnostic[],
) {
  const remainingRequests = MAX_THESPORTSDB_REQUESTS_PER_SYNC - summary.provedores.thesportsdb;
  if (remainingRequests <= 0) return;

  const existingCodesResult = await supabase.from("selecoes_sportsdb").select("codigo");

  if (existingCodesResult.error) {
    if (isMissingSportsDbSelectionCacheError(existingCodesResult.error)) return;

    throw new Error(`Falha ao consultar seleções mapeadas: ${existingCodesResult.error.message}`);
  }

  const existingCodes = new Set(
    ((existingCodesResult.data ?? []) as Array<{ codigo: string | null }>)
      .map((row) => row.codigo)
      .filter((codigo): codigo is string => Boolean(codigo)),
  );
  for (const codigo of mappedSelections.keys()) existingCodes.add(codigo);

  const gamesResult = await supabase
    .from("jogos")
    .select("id,sportsdb_event_id,time1,time2,data,encerrado,estatisticas")
    .not("sportsdb_event_id", "is", null)
    .order("data", { ascending: true })
    .limit(72);

  if (gamesResult.error) {
    throw new Error(`Falha ao consultar jogos para mapear seleções: ${gamesResult.error.message}`);
  }

  const candidates = ((gamesResult.data ?? []) as JogoSync[]).filter((jogo) =>
    [jogo.time1, jogo.time2].some((team) => {
      const code = teamCodeFromName(team);
      return code && !existingCodes.has(code);
    }),
  );
  const lookupLimit = Math.min(
    remainingRequests,
    SELECTION_MAPPING_BACKFILL_LIMIT,
    candidates.length,
  );

  for (const jogo of candidates.slice(0, lookupLimit)) {
    if (!jogo.sportsdb_event_id) continue;

    let scoreLookup;
    try {
      summary.provedores.thesportsdb += 1;
      scoreLookup = await lookupSportsDbScoreWithRaw(jogo.sportsdb_event_id);
    } catch (error) {
      diagnostics.push(createDiagnostic(jogo, "selecoes", null, null, errorMessage(error)));
      continue;
    }

    const score = scoreLookup.data;
    diagnostics.push(createDiagnostic(jogo, "selecoes", score, scoreLookup.raw));
    if (!score) continue;

    await mapSportsDbSelections(supabase, jogo, score, summary, mappedSelections);
    for (const team of [jogo.time1, jogo.time2]) {
      const code = teamCodeFromName(team);
      if (code) existingCodes.add(code);
    }
  }
}

async function mapSportsDbSelections(
  supabase: ReturnType<typeof createAdminClient>,
  jogo: JogoSync,
  score: SportsDbScore,
  summary: SyncSummary,
  mappedSelections: Map<string, SportsDbSelectionCandidate>,
) {
  const candidates = [
    toSportsDbSelectionCandidate(jogo.time1, score.homeTeam),
    toSportsDbSelectionCandidate(jogo.time2, score.awayTeam),
  ].filter((candidate): candidate is SportsDbSelectionCandidate => candidate != null);

  for (const candidate of candidates) {
    const { error } = await supabase.from("selecoes_sportsdb").upsert(
      {
        codigo: candidate.codigo,
        nome: candidate.nome,
        sportsdb_team_id: candidate.sportsdb_team_id,
        sportsdb_team_name: candidate.sportsdb_team_name,
      },
      { onConflict: "codigo" },
    );

    if (error) {
      if (isMissingSportsDbSelectionCacheError(error)) return;

      throw new Error(`Falha ao mapear ${candidate.nome} no TheSportsDB: ${error.message}`);
    }

    summary.selecoes_mapeadas += 1;
    mappedSelections.set(candidate.codigo, candidate);
  }
}

function toSportsDbSelectionCandidate(
  nome: string,
  team: SportsDbScore["homeTeam"],
): SportsDbSelectionCandidate | null {
  const codigo = teamCodeFromName(nome);
  if (!codigo || !team.id) return null;

  return {
    codigo,
    nome,
    sportsdb_team_id: team.id,
    sportsdb_team_name: team.name,
  };
}

async function synchronizeSelectionPlayers(
  supabase: ReturnType<typeof createAdminClient>,
  recentlyMapped: SportsDbSelectionCandidate[],
  summary: SyncSummary,
  diagnostics: SyncDiagnostic[],
) {
  const remainingRequests = MAX_THESPORTSDB_REQUESTS_PER_SYNC - summary.provedores.thesportsdb;
  if (remainingRequests <= 0) return;

  const targets = await getSelectionPlayerSyncTargets(supabase, recentlyMapped, remainingRequests);

  for (const target of targets) {
    if (summary.provedores.thesportsdb >= MAX_THESPORTSDB_REQUESTS_PER_SYNC) return;

    let playersLookup;
    try {
      summary.provedores.thesportsdb += 1;
      playersLookup = await lookupSportsDbTeamPlayers(target.sportsdb_team_id);
    } catch (error) {
      diagnostics.push(createSelectionDiagnostic(target, null, null, errorMessage(error)));
      await supabase
        .from("selecoes_sportsdb")
        .update({ erro_sync: errorMessage(error) })
        .eq("codigo", target.codigo);
      continue;
    }

    diagnostics.push(createSelectionDiagnostic(target, playersLookup.data, playersLookup.raw));

    const { error } = await supabase
      .from("selecoes_sportsdb")
      .update({
        jogadores: playersLookup.data,
        sincronizado_em: new Date().toISOString(),
        erro_sync: null,
      })
      .eq("codigo", target.codigo);

    if (error) {
      throw new Error(`Falha ao salvar convocados de ${target.nome}: ${error.message}`);
    }

    summary.convocados_sincronizados += 1;
  }
}

async function getSelectionPlayerSyncTargets(
  supabase: ReturnType<typeof createAdminClient>,
  recentlyMapped: SportsDbSelectionCandidate[],
  limit: number,
) {
  const byCode = new Map<string, SportsDbSelectionCandidate>();
  const staleCutoff = new Date(Date.now() - PLAYERS_CACHE_TTL_MS).toISOString();
  const recentlyMappedCodes = recentlyMapped.map((selection) => selection.codigo);

  if (recentlyMappedCodes.length) {
    const recentResult = await supabase
      .from("selecoes_sportsdb")
      .select("codigo,nome,sportsdb_team_id,sportsdb_team_name,jogadores,sincronizado_em")
      .in("codigo", recentlyMappedCodes);

    if (recentResult.error) {
      if (isMissingSportsDbSelectionCacheError(recentResult.error)) return [];

      throw new Error(`Falha ao consultar cache recém-mapeado: ${recentResult.error.message}`);
    }

    for (const row of (recentResult.data ?? []) as SportsDbSelectionCacheRow[]) {
      if (shouldSyncPlayers(row, staleCutoff)) {
        byCode.set(row.codigo, {
          codigo: row.codigo,
          nome: row.nome,
          sportsdb_team_id: row.sportsdb_team_id,
          sportsdb_team_name: row.sportsdb_team_name,
        });
      }
    }
  }

  const staleResult = await supabase
    .from("selecoes_sportsdb")
    .select("codigo,nome,sportsdb_team_id,sportsdb_team_name,jogadores,sincronizado_em")
    .or(`sincronizado_em.is.null,sincronizado_em.lt.${staleCutoff}`)
    .order("sincronizado_em", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (staleResult.error) {
    if (isMissingSportsDbSelectionCacheError(staleResult.error)) return [];

    throw new Error(`Falha ao consultar cache de convocados: ${staleResult.error.message}`);
  }

  for (const row of (staleResult.data ?? []) as SportsDbSelectionCacheRow[]) {
    byCode.set(row.codigo, {
      codigo: row.codigo,
      nome: row.nome,
      sportsdb_team_id: row.sportsdb_team_id,
      sportsdb_team_name: row.sportsdb_team_name,
    });
  }

  return [...byCode.values()].slice(0, limit);
}

function shouldSyncPlayers(row: SportsDbSelectionCacheRow, staleCutoff: string) {
  const hasPlayers = Array.isArray(row.jogadores) && row.jogadores.length > 0;
  return !hasPlayers || !row.sincronizado_em || row.sincronizado_em < staleCutoff;
}

function isMissingSportsDbSelectionCacheError(error: { message: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    /selecoes_sportsdb/i.test(error.message) ||
    /schema cache/i.test(error.message)
  );
}

async function synchronizeStatistics(
  supabase: ReturnType<typeof createAdminClient>,
  jogo: JogoSync,
  summary: SyncSummary,
  diagnostics: SyncDiagnostic[],
) {
  if (!jogo.sportsdb_event_id) return;

  let statisticsLookup;
  try {
    statisticsLookup = await lookupSportsDbEventStatisticsWithRaw(jogo.sportsdb_event_id);
  } catch (error) {
    diagnostics.push(createDiagnostic(jogo, "estatisticas", null, null, errorMessage(error)));
    throw error;
  }

  const statistics = statisticsLookup.data;
  diagnostics.push(createDiagnostic(jogo, "estatisticas", statistics, statisticsLookup.raw));
  if (!statistics.length) return;

  const { error } = await supabase
    .from("jogos")
    .update({
      estatisticas: statistics,
      estatisticas_sincronizadas_em: new Date().toISOString(),
    })
    .eq("id", jogo.id);

  if (error) {
    throw new Error(`Falha ao salvar estatísticas do jogo ${jogo.id}: ${error.message}`);
  }

  summary.estatisticas_sincronizadas += 1;
  summary.provedores.thesportsdb += 1;
}

function createDiagnostic(
  jogo: JogoSync,
  tipo: SyncDiagnostic["tipo"],
  interpretado: unknown,
  resposta: unknown,
  erro?: string,
): SyncDiagnostic {
  return {
    jogo_id: jogo.id,
    evento_id: jogo.sportsdb_event_id ?? "",
    jogo: `${jogo.time1} x ${jogo.time2}`,
    tipo,
    consultado_em: new Date().toISOString(),
    interpretado,
    resposta,
    ...(erro ? { erro } : {}),
  };
}

function createSelectionDiagnostic(
  selection: SportsDbSelectionCandidate,
  interpretado: unknown,
  resposta: unknown,
  erro?: string,
): SyncDiagnostic {
  return {
    jogo_id: "",
    evento_id: selection.sportsdb_team_id,
    jogo: selection.nome,
    tipo: "convocados",
    consultado_em: new Date().toISOString(),
    interpretado,
    resposta,
    ...(erro ? { erro } : {}),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro desconhecido.";
}

function nowAsStoredBrasiliaIso() {
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

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`;
}
