import type { SupabaseClient } from "@supabase/supabase-js";

import { teamCodeFromName } from "@/data/iso2";
import {
  lookupApiFootballSquad,
  searchApiFootballTeams,
  type ApiFootballPlayer,
  type ApiFootballTeam,
} from "@/lib/apifootball";

type SelectionSourceRow = {
  time?: string | null;
  time1?: string | null;
  time2?: string | null;
};

type SelectionSyncRow = {
  codigo: string;
  nome: string;
  api_football_team_id: number | null;
  api_football_team_name: string | null;
  api_football_logo_url: string | null;
  jogadores_sincronizados_em: string | null;
  erro_sync: string | null;
};

type PlayerSelectionRow = {
  selecao_codigo: string | null;
};

type SelectionTarget = {
  codigo: string;
  nome: string;
  apiFootballTeamId: number | null;
  apiFootballTeamName: string | null;
  apiFootballLogoUrl: string | null;
  synchronizedAt: string | null;
  syncError: string | null;
  playerCount: number;
};

export type SelectionPlayersSyncResult = {
  ok: boolean;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  selecoes_processadas: number;
  selecoes_com_erro: number;
  jogadores_salvos: number;
  chamadas_api_football: number;
  modo: "pendentes" | "completo";
  erros: Array<{ codigo: string; nome: string; erro: string }>;
};

const API_FOOTBALL_SEARCH_TERMS: Record<string, string[]> = {
  ALG: ["Algeria"],
  ARG: ["Argentina"],
  AUS: ["Australia"],
  AUT: ["Austria"],
  BEL: ["Belgium"],
  BIH: ["Bosnia and Herzegovina", "Bosnia"],
  BRA: ["Brazil"],
  CAN: ["Canada"],
  CHI: ["Chile"],
  CIV: ["Ivory Coast", "Cote d'Ivoire"],
  COD: ["Congo DR", "DR Congo"],
  COL: ["Colombia"],
  CPV: ["Cape Verde"],
  CRC: ["Costa Rica"],
  CRO: ["Croatia"],
  CUW: ["Curacao"],
  CZE: ["Czech Republic", "Czechia"],
  DEN: ["Denmark"],
  ECU: ["Ecuador"],
  EGY: ["Egypt"],
  ENG: ["England"],
  ESP: ["Spain"],
  FRA: ["France"],
  GER: ["Germany"],
  GHA: ["Ghana"],
  HAI: ["Haiti"],
  IRN: ["Iran"],
  IRQ: ["Iraq"],
  ITA: ["Italy"],
  JOR: ["Jordan"],
  JPN: ["Japan"],
  KOR: ["South Korea", "Korea Republic"],
  MAR: ["Morocco"],
  MEX: ["Mexico"],
  NED: ["Netherlands"],
  NOR: ["Norway"],
  NZL: ["New Zealand"],
  PAN: ["Panama"],
  PAR: ["Paraguay"],
  POR: ["Portugal"],
  QAT: ["Qatar"],
  RSA: ["South Africa"],
  SAU: ["Saudi Arabia"],
  SCO: ["Scotland"],
  SEN: ["Senegal"],
  SRB: ["Serbia"],
  SUI: ["Switzerland"],
  SWE: ["Sweden"],
  TUN: ["Tunisia"],
  TUR: ["Turkey"],
  URU: ["Uruguay"],
  USA: ["USA", "United States"],
  UZB: ["Uzbekistan"],
};

export async function synchronizeSelectionPlayers(
  supabase: SupabaseClient,
): Promise<SelectionPlayersSyncResult> {
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  const summary = {
    selecoes_processadas: 0,
    selecoes_com_erro: 0,
    jogadores_salvos: 0,
    chamadas_api_football: 0,
    modo: "pendentes" as "pendentes" | "completo",
    erros: [] as Array<{ codigo: string; nome: string; erro: string }>,
  };

  const { targets, mode } = await getSelectionTargets(supabase);
  summary.modo = mode;

  for (const target of targets) {
    try {
      const resolvedLookup = target.apiFootballTeamId
        ? { target, requestCount: 0 }
        : await resolveSelectionTeam(target);
      const resolved = resolvedLookup.target;
      summary.chamadas_api_football += resolvedLookup.requestCount;

      if (!resolved.apiFootballTeamId) {
        throw new Error("Seleção não encontrada na API-Football.");
      }

      await upsertSelection(supabase, resolved, { clearError: true });

      const squadLookup = await lookupApiFootballSquad(resolved.apiFootballTeamId);
      summary.chamadas_api_football += 1;

      await savePlayers(supabase, resolved, squadLookup.data.players);
      await upsertSelection(
        supabase,
        {
          ...resolved,
          apiFootballTeamName: squadLookup.data.team?.name ?? resolved.apiFootballTeamName,
          apiFootballLogoUrl: squadLookup.data.team?.logo ?? resolved.apiFootballLogoUrl,
        },
        { synchronizedAt: new Date().toISOString(), clearError: true },
      );

      summary.selecoes_processadas += 1;
      summary.jogadores_salvos += squadLookup.data.players.length;
    } catch (error) {
      const message = errorMessage(error);
      summary.selecoes_com_erro += 1;
      summary.erros.push({ codigo: target.codigo, nome: target.nome, erro: message });
      await upsertSelection(supabase, target, { error: message });
    }
  }

  const finishedAt = Date.now();

  return {
    ok: summary.selecoes_com_erro === 0,
    started_at: startedAtIso,
    finished_at: new Date(finishedAt).toISOString(),
    duration_ms: finishedAt - startedAt,
    ...summary,
  };
}

async function getSelectionTargets(supabase: SupabaseClient) {
  const [groupsResult, gamesResult, existingResult, playersResult] = await Promise.all([
    supabase.from("grupos").select("time"),
    supabase.from("jogos").select("time1,time2"),
    supabase
      .from("selecao")
      .select(
        "codigo,nome,api_football_team_id,api_football_team_name,api_football_logo_url,jogadores_sincronizados_em,erro_sync",
      ),
    supabase.from("jogador").select("selecao_codigo"),
  ]);

  if (groupsResult.error) throw new Error(groupsResult.error.message);
  if (gamesResult.error) throw new Error(gamesResult.error.message);
  if (existingResult.error && !isMissingSelectionTableError(existingResult.error)) {
    throw new Error(existingResult.error.message);
  }
  if (playersResult.error && !isMissingSelectionTableError(playersResult.error)) {
    throw new Error(playersResult.error.message);
  }

  const names = new Set<string>();
  ((groupsResult.data ?? []) as SelectionSourceRow[]).forEach((row) => addName(names, row.time));
  ((gamesResult.data ?? []) as SelectionSourceRow[]).forEach((row) => {
    addName(names, row.time1);
    addName(names, row.time2);
  });

  const existingByCode = new Map(
    ((existingResult.data ?? []) as SelectionSyncRow[]).map((row) => [row.codigo, row]),
  );
  const playerCountByCode = ((playersResult.data ?? []) as PlayerSelectionRow[]).reduce<
    Map<string, number>
  >((acc, row) => {
    if (!row.selecao_codigo) return acc;
    acc.set(row.selecao_codigo, (acc.get(row.selecao_codigo) ?? 0) + 1);
    return acc;
  }, new Map());

  const allTargets = [...names]
    .map((nome) => {
      const codigo = teamCodeFromName(nome);
      if (!codigo) return null;
      const existing = existingByCode.get(codigo);

      return {
        codigo,
        nome,
        apiFootballTeamId: existing?.api_football_team_id ?? null,
        apiFootballTeamName: existing?.api_football_team_name ?? null,
        apiFootballLogoUrl: existing?.api_football_logo_url ?? null,
        synchronizedAt: existing?.jogadores_sincronizados_em ?? null,
        syncError: existing?.erro_sync ?? null,
        playerCount: playerCountByCode.get(codigo) ?? 0,
      };
    })
    .filter((target): target is SelectionTarget => target != null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const pendingTargets = allTargets.filter(shouldSyncPendingSelection);
  return pendingTargets.length
    ? { targets: pendingTargets, mode: "pendentes" as const }
    : { targets: allTargets, mode: "completo" as const };
}

function shouldSyncPendingSelection(target: SelectionTarget) {
  return Boolean(target.syncError || !target.synchronizedAt || target.playerCount === 0);
}

async function resolveSelectionTeam(
  target: SelectionTarget,
): Promise<{ target: SelectionTarget; requestCount: number }> {
  const terms = selectionSearchTerms(target);
  let requestCount = 0;

  for (const term of terms) {
    const lookup = await searchApiFootballTeams(term);
    requestCount += 1;
    const team = chooseBestTeam(lookup.data, target, term);
    if (!team) continue;

    return {
      target: {
        ...target,
        apiFootballTeamId: team.id,
        apiFootballTeamName: team.name,
        apiFootballLogoUrl: team.logo,
      },
      requestCount,
    };
  }

  return { target, requestCount };
}

function selectionSearchTerms(target: SelectionTarget) {
  return [...new Set([...(API_FOOTBALL_SEARCH_TERMS[target.codigo] ?? []), target.nome])];
}

function chooseBestTeam(
  teams: ApiFootballTeam[],
  target: SelectionTarget,
  term: string,
): ApiFootballTeam | null {
  const nationalTeams = teams.filter((team) => team.national !== false);
  const candidates = nationalTeams.length ? nationalTeams : teams;
  const targetCode = target.codigo.toLocaleUpperCase("en-US");
  const normalizedTerm = normalizeSearchText(term);

  return (
    candidates.find((team) => team.code?.toLocaleUpperCase("en-US") === targetCode) ??
    candidates.find((team) => normalizeSearchText(team.name) === normalizedTerm) ??
    candidates[0] ??
    null
  );
}

async function upsertSelection(
  supabase: SupabaseClient,
  target: SelectionTarget,
  options: { synchronizedAt?: string; error?: string; clearError?: boolean } = {},
) {
  const payload = {
    codigo: target.codigo,
    nome: target.nome,
    api_football_team_id: target.apiFootballTeamId,
    api_football_team_name: target.apiFootballTeamName,
    api_football_logo_url: target.apiFootballLogoUrl,
    ...(options.synchronizedAt ? { jogadores_sincronizados_em: options.synchronizedAt } : {}),
    ...(options.error ? { erro_sync: options.error } : {}),
    ...(options.clearError ? { erro_sync: null } : {}),
  };

  const { error } = await supabase.from("selecao").upsert(payload, { onConflict: "codigo" });
  if (error) throw new Error(`Falha ao salvar seleção ${target.nome}: ${error.message}`);
}

async function savePlayers(
  supabase: SupabaseClient,
  target: SelectionTarget,
  players: ApiFootballPlayer[],
) {
  const deleted = await supabase.from("jogador").delete().eq("selecao_codigo", target.codigo);
  if (deleted.error) {
    throw new Error(`Falha ao limpar jogadores de ${target.nome}: ${deleted.error.message}`);
  }

  if (!players.length) return;

  const synchronizedAt = new Date().toISOString();
  const inserted = await supabase.from("jogador").insert(
    players.map((player) => ({
      selecao_codigo: target.codigo,
      api_football_player_id: player.id,
      nome: player.nome,
      idade: player.idade,
      numero: player.numero,
      posicao: player.posicao,
      foto_url: player.foto_url,
      sincronizado_em: synchronizedAt,
    })),
  );

  if (inserted.error) {
    throw new Error(`Falha ao salvar jogadores de ${target.nome}: ${inserted.error.message}`);
  }
}

function addName(names: Set<string>, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) names.add(trimmed);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("en-US");
}

function isMissingSelectionTableError(error: { message: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    /selecao/i.test(error.message) ||
    /schema cache/i.test(error.message)
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro desconhecido.";
}
