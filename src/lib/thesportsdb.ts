export type SportsDbEvent = {
  idEvent?: string;
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
};

export type SportsDbEventStatistic = {
  name: string;
  home: number | null;
  away: number | null;
};

type SportsDbEventStatisticResponse = {
  idEvent?: string;
  strStat?: string | null;
  intHome?: string | null;
  intAway?: string | null;
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

export async function lookupSportsDbScore(eventId: string): Promise<SportsDbScore | null> {
  const response = await fetch(`${BASE_URL}/lookupevent.php?id=${encodeURIComponent(eventId)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TheSportsDB retornou ${response.status} para o evento ${eventId}.`);
  }

  const body = (await response.json()) as { events?: SportsDbEvent[] | null };
  const event = body.events?.[0];
  if (!event) return null;

  const status = event.strStatus ?? event.strProgress ?? null;

  return {
    eventId,
    gols1: parseNumber(event.intHomeScore),
    gols2: parseNumber(event.intAwayScore),
    encerrado: isFinished(status),
    status,
  };
}

export async function lookupSportsDbEventStatistics(
  eventId: string,
): Promise<SportsDbEventStatistic[]> {
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

  return (body.eventstats ?? [])
    .filter((statistic) => statistic.strStat?.trim())
    .map((statistic) => ({
      name: statistic.strStat!.trim(),
      home: parseNumber(statistic.intHome),
      away: parseNumber(statistic.intAway),
    }));
}
