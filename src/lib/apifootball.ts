export type ApiFootballTeam = {
  id: number;
  name: string;
  code: string | null;
  country: string | null;
  national: boolean | null;
  logo: string | null;
};

export type ApiFootballPlayer = {
  id: number;
  nome: string;
  idade: number | null;
  numero: number | null;
  posicao: string | null;
  foto_url: string | null;
};

export type ApiFootballLookup<T> = {
  data: T;
  raw: unknown;
};

type ApiFootballEnvelope<T> = {
  response?: T;
  errors?: unknown;
};

type ApiFootballTeamResponse = {
  team?: {
    id?: number | null;
    name?: string | null;
    code?: string | null;
    country?: string | null;
    national?: boolean | null;
    logo?: string | null;
  } | null;
};

type ApiFootballSquadResponse = {
  team?: {
    id?: number | null;
    name?: string | null;
    logo?: string | null;
  } | null;
  players?: Array<{
    id?: number | null;
    name?: string | null;
    age?: number | null;
    number?: number | null;
    position?: string | null;
    photo?: string | null;
  }> | null;
};

const BASE_URL = "https://v3.football.api-sports.io";

export function hasApiFootballCredentials() {
  return Boolean(process.env.API_FOOTBALL_KEY);
}

export async function searchApiFootballTeams(
  search: string,
): Promise<ApiFootballLookup<ApiFootballTeam[]>> {
  const body = await requestApiFootball<ApiFootballTeamResponse[]>(
    `/teams?search=${encodeURIComponent(search)}`,
  );

  return {
    data: (body.response ?? [])
      .map((item) => normalizeTeam(item))
      .filter((team): team is ApiFootballTeam => team != null),
    raw: body,
  };
}

export async function lookupApiFootballSquad(
  teamId: number,
): Promise<ApiFootballLookup<{ team: ApiFootballTeam | null; players: ApiFootballPlayer[] }>> {
  const body = await requestApiFootball<ApiFootballSquadResponse[]>(
    `/players/squads?team=${encodeURIComponent(String(teamId))}`,
  );
  const squad = body.response?.[0] ?? null;
  const team = squad?.team?.id
    ? {
        id: squad.team.id,
        name: cleanText(squad.team.name) ?? String(squad.team.id),
        code: null,
        country: null,
        national: null,
        logo: cleanText(squad.team.logo),
      }
    : null;

  return {
    data: {
      team,
      players: (squad?.players ?? [])
        .map((player) => normalizePlayer(player))
        .filter((player): player is ApiFootballPlayer => player != null),
    },
    raw: body,
  };
}

async function requestApiFootball<T>(path: string): Promise<ApiFootballEnvelope<T>> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error("API_FOOTBALL_KEY não está configurada.");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    cache: "no-store",
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football retornou ${response.status}.`);
  }

  const body = (await response.json()) as ApiFootballEnvelope<T>;
  if (hasApiErrors(body.errors)) {
    throw new Error(`API-Football retornou erro: ${formatApiErrors(body.errors)}.`);
  }

  return body;
}

function normalizeTeam(item: ApiFootballTeamResponse): ApiFootballTeam | null {
  const team = item.team;
  const id = team?.id;
  const name = cleanText(team?.name);
  if (!id || !name) return null;

  return {
    id,
    name,
    code: cleanText(team?.code),
    country: cleanText(team?.country),
    national: team?.national ?? null,
    logo: cleanText(team?.logo),
  };
}

function normalizePlayer(player: NonNullable<ApiFootballSquadResponse["players"]>[number]) {
  const id = player.id;
  const nome = cleanText(player.name);
  if (!id || !nome) return null;

  return {
    id,
    nome,
    idade: normalizeNumber(player.age),
    numero: normalizeNumber(player.number),
    posicao: cleanText(player.position),
    foto_url: cleanText(player.photo),
  };
}

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function hasApiErrors(errors: unknown) {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors).length > 0;
  return Boolean(errors);
}

function formatApiErrors(errors: unknown) {
  if (typeof errors === "string") return errors;
  try {
    return JSON.stringify(errors);
  } catch {
    return "erro desconhecido";
  }
}
