export type SportsDbEvent = {
  idEvent?: string;
  idHomeTeam?: string | null;
  idAwayTeam?: string | null;
  strHomeTeam?: string | null;
  strAwayTeam?: string | null;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strStatus?: string | null;
  strProgress?: string | null;
};

export type SportsDbScore = {
  eventId: string;
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
  status: string | null;
  homeTeam: {
    id: string | null;
    name: string | null;
  };
  awayTeam: {
    id: string | null;
    name: string | null;
  };
};

export type SportsDbEventStatistic = {
  name: string;
  home: number | null;
  away: number | null;
};

export type SportsDbTeamPlayer = {
  id: string;
  nome: string;
  posicao: string | null;
  clube: string | null;
  numero: string | null;
  foto_url: string | null;
};

export type SportsDbLookup<T> = {
  data: T;
  raw: unknown;
  requestCount?: number;
};

type SportsDbEventStatisticResponse = {
  idEvent?: string;
  strStat?: string | null;
  intHome?: string | null;
  intAway?: string | null;
};

type SportsDbTeamPlayerResponse = {
  idPlayer?: string | null;
  strPlayer?: string | null;
  strPosition?: string | null;
  strTeam?: string | null;
  strTeam2?: string | null;
  strNumber?: string | null;
  strCutout?: string | null;
  strThumb?: string | null;
};

const API_KEY = process.env.THESPORTSDB_API_KEY ?? "123";
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

function parseNumber(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFinished(status: string | null) {
  if (!status) return false;
  return /^(ft|aet|pen|match finished|finished|full time)$/i.test(status.trim());
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function lookupSportsDbScore(eventId: string): Promise<SportsDbScore | null> {
  const result = await lookupSportsDbScoreWithRaw(eventId);
  return result.data;
}

export async function lookupSportsDbScoreWithRaw(
  eventId: string,
): Promise<SportsDbLookup<SportsDbScore | null>> {
  const response = await fetch(`${BASE_URL}/lookupevent.php?id=${encodeURIComponent(eventId)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TheSportsDB retornou ${response.status} para o evento ${eventId}.`);
  }

  const body = (await response.json()) as { events?: SportsDbEvent[] | null };
  const event = body.events?.[0];
  if (!event) return { data: null, raw: body };

  const status = event.strStatus ?? event.strProgress ?? null;

  return {
    data: {
      eventId,
      gols1: parseNumber(event.intHomeScore),
      gols2: parseNumber(event.intAwayScore),
      encerrado: isFinished(status),
      status,
      homeTeam: {
        id: cleanText(event.idHomeTeam),
        name: cleanText(event.strHomeTeam),
      },
      awayTeam: {
        id: cleanText(event.idAwayTeam),
        name: cleanText(event.strAwayTeam),
      },
    },
    raw: body,
  };
}

export async function lookupSportsDbEventStatistics(
  eventId: string,
): Promise<SportsDbEventStatistic[]> {
  const result = await lookupSportsDbEventStatisticsWithRaw(eventId);
  return result.data;
}

export async function lookupSportsDbEventStatisticsWithRaw(
  eventId: string,
): Promise<SportsDbLookup<SportsDbEventStatistic[]>> {
  const response = await fetch(
    `${BASE_URL}/lookupeventstats.php?id=${encodeURIComponent(eventId)}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(
      `TheSportsDB retornou ${response.status} nas estatísticas do evento ${eventId}.`,
    );
  }

  const body = (await response.json()) as {
    eventstats?: SportsDbEventStatisticResponse[] | null;
  };

  return {
    data: (body.eventstats ?? [])
      .filter((statistic) => statistic.strStat?.trim())
      .map((statistic) => ({
        name: statistic.strStat!.trim(),
        home: parseNumber(statistic.intHome),
        away: parseNumber(statistic.intAway),
      })),
    raw: body,
  };
}

export async function lookupSportsDbTeamPlayers(
  teamId: string,
  options: { maxRequests?: number } = {},
): Promise<SportsDbLookup<SportsDbTeamPlayer[]>> {
  const maxPlayers = 60;
  const maxRosterItems = 64;
  const maxRequests = Math.max(1, options.maxRequests ?? 3);
  const playersById = new Map<string, SportsDbTeamPlayer>();
  const coachesById = new Map<string, SportsDbTeamPlayer>();
  const rawResponses: unknown[] = [];
  let requestCount = 0;

  for (const url of buildPlayerLookupUrls(teamId, maxPlayers).slice(0, maxRequests)) {
    const response = await fetch(url, { cache: "no-store" });
    requestCount += 1;

    if (!response.ok) {
      throw new Error(`TheSportsDB retornou ${response.status} nos jogadores do time ${teamId}.`);
    }

    const body = (await response.json()) as {
      player?: SportsDbTeamPlayerResponse[] | null;
    };
    rawResponses.push(body);

    const normalizedPlayers = normalizeSportsDbPlayers(body.player ?? []);
    const previousSize = playersById.size + coachesById.size;
    normalizedPlayers.forEach((player) => {
      if (isCoachPosition(player.posicao)) {
        coachesById.set(player.id, player);
        return;
      }

      playersById.set(player.id, player);
    });

    if (playersById.size + coachesById.size >= maxRosterItems) break;
    if (!normalizedPlayers.length || playersById.size + coachesById.size === previousSize) break;
  }

  return {
    data: [...playersById.values(), ...coachesById.values()].slice(0, maxRosterItems),
    raw: rawResponses.length === 1 ? rawResponses[0] : { pages: rawResponses },
    requestCount,
  };
}

function buildPlayerLookupUrls(teamId: string, maxPlayers: number) {
  const encodedTeamId = encodeURIComponent(teamId);
  const base = `${BASE_URL}/lookup_all_players.php?id=${encodedTeamId}`;

  return [
    `${base}&limit=${maxPlayers}&per_page=${maxPlayers}`,
    `${base}&limit=${maxPlayers}&per_page=${maxPlayers}&page=2&offset=${maxPlayers}`,
    `${base}&limit=${maxPlayers}&per_page=${maxPlayers}&page=3&offset=${maxPlayers * 2}`,
  ];
}

function normalizeSportsDbPlayers(players: SportsDbTeamPlayerResponse[]) {
  return players
    .map((player) => {
      const id = cleanText(player.idPlayer);
      const nome = cleanText(player.strPlayer);
      if (!id || !nome) return null;

      return {
        id,
        nome,
        posicao: cleanText(player.strPosition),
        clube: cleanText(player.strTeam2) ?? cleanText(player.strTeam),
        numero: cleanText(player.strNumber),
        foto_url: cleanText(player.strCutout) ?? cleanText(player.strThumb),
      };
    })
    .filter((player): player is SportsDbTeamPlayer => player != null);
}

function isCoachPosition(position: string | null) {
  const normalized = (position ?? "")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[-_/]+/g, " ");

  return (
    normalized.includes("coach") ||
    normalized.includes("manager") ||
    normalized.includes("trainer") ||
    normalized.includes("head coach")
  );
}
