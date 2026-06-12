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

const API_KEY = process.env.THESPORTSDB_API_KEY ?? "123";
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

function parseScore(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
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
    gols1: parseScore(event.intHomeScore),
    gols2: parseScore(event.intAwayScore),
    encerrado: isFinished(status),
    status,
  };
}
