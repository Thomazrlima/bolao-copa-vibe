export const PALPITES_UPDATED_EVENT = "palpites-updated";
export const MOCK_PALPITE_ID_PREFIX = "mock-palpite-";

export const MOCK_PENDING_GUESSES_ENABLED =
  process.env.NEXT_PUBLIC_MOCK_PENDING_GUESSES?.toLowerCase() === "true";

export type PalpiteUrgency = "reminder" | "attention" | "critical" | "imminent";

export type PalpiteDeadline = {
  urgency: PalpiteUrgency;
  remainingMs: number;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export function getPalpiteDeadline(
  gameDate: string,
  now = nowAsStoredBrasiliaMs(),
): PalpiteDeadline | null {
  const remainingMs = new Date(gameDate).getTime() - now;

  if (remainingMs <= 0 || remainingMs > 24 * HOUR_MS) return null;
  if (remainingMs <= 10 * MINUTE_MS) return { urgency: "imminent", remainingMs };
  if (remainingMs <= HOUR_MS) return { urgency: "critical", remainingMs };
  if (remainingMs <= 6 * HOUR_MS) return { urgency: "attention", remainingMs };
  return { urgency: "reminder", remainingMs };
}

export function formatPalpiteTimeRemaining(remainingMs: number) {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / MINUTE_MS));

  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

export function urgencyRank(urgency: PalpiteUrgency) {
  return {
    reminder: 0,
    attention: 1,
    critical: 2,
    imminent: 3,
  }[urgency];
}

export function isMockPalpiteGame(gameId: string) {
  return gameId.startsWith(MOCK_PALPITE_ID_PREFIX);
}

export function nowAsStoredBrasiliaMs(date = new Date()) {
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
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return Date.parse(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`,
  );
}
