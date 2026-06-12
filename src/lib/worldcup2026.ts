export type WorldCup2026MatchStatus = "upcoming" | "live" | "finished";

export type WorldCup2026Game = {
  id?: string | number | null;
  home_score?: string | number | null;
  away_score?: string | number | null;
  finished?: string | boolean | null;
  time_elapsed?: string | number | null;
};

export type WorldCup2026Score = {
  gameId: string;
  gols1: number | null;
  gols2: number | null;
  placarStatus: WorldCup2026MatchStatus;
  statusOrigem: string | null;
};

const BASE_URL = process.env.WORLDCUP2026_API_BASE ?? "https://worldcup26.ir";
const FINISHED_MARKERS = new Set(["FT", "AET", "PEN", "FINISHED", "FULLTIME", "FULL TIME"]);
const UPCOMING_MARKERS = new Set(["", "NOTSTARTED", "NOT STARTED", "NS", "SCHEDULED", "TBD"]);

function parseScore(value: string | number | null | undefined) {
  if (value == null || value === "" || value === "null") return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function truthyFinished(value: string | boolean | null | undefined) {
  if (typeof value === "boolean") return value;
  if (!value) return false;
  return value.trim().toUpperCase() === "TRUE";
}

export function normalizeWorldCup2026Status(game: WorldCup2026Game): WorldCup2026MatchStatus {
  const rawStatus = String(game.time_elapsed ?? "").trim();
  const normalized = rawStatus.toUpperCase();

  if (truthyFinished(game.finished) || FINISHED_MARKERS.has(normalized)) return "finished";
  if (UPCOMING_MARKERS.has(normalized)) return "upcoming";
  return "live";
}

export function normalizeWorldCup2026Game(game: WorldCup2026Game): WorldCup2026Score | null {
  if (game.id == null || game.id === "") return null;

  return {
    gameId: String(game.id),
    gols1: parseScore(game.home_score),
    gols2: parseScore(game.away_score),
    placarStatus: normalizeWorldCup2026Status(game),
    statusOrigem: game.time_elapsed == null ? null : String(game.time_elapsed),
  };
}

export async function lookupWorldCup2026Scores(): Promise<Map<string, WorldCup2026Score>> {
  const response = await fetch(`${BASE_URL}/get/games`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`WorldCup2026 API retornou ${response.status} em /get/games.`);
  }

  const body = (await response.json()) as { games?: WorldCup2026Game[] | null };
  const scores = new Map<string, WorldCup2026Score>();

  for (const game of body.games ?? []) {
    const score = normalizeWorldCup2026Game(game);
    if (score) scores.set(score.gameId, score);
  }

  return scores;
}
