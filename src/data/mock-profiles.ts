import { ALL_FIXTURES, type Fixture, type Score } from "@/data/fixtures";
import { PARTICIPANTS } from "@/data/participants";
import { TEAM_BY_CODE } from "@/data/teams";
import { compareGuess, pointsFor, type GuessOutcome } from "@/lib/scoring";

export type MockProfileGuess = {
  fixture: Fixture;
  guess: Score;
  result: Score | null;
  outcome: GuessOutcome | null;
  points: number | null;
};

export type MockProfile = {
  id: string;
  name: string;
  points: number;
  stats: Record<GuessOutcome, number>;
  guesses: MockProfileGuess[];
};

const OUTCOMES: GuessOutcome[] = ["chinelada", "strong", "result", "goals", "miss"];

function hash(value: string) {
  return [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
}

function findGuess(result: Score, outcome: GuessOutcome, seed: number): Score | null {
  const candidates: Score[] = [];

  for (let home = 0; home <= 5; home += 1) {
    for (let away = 0; away <= 5; away += 1) {
      const guess = { home, away };
      if (compareGuess(guess, result) === outcome) candidates.push(guess);
    }
  }

  return candidates[seed % candidates.length] ?? null;
}

function teamName(code?: string) {
  return code ? (TEAM_BY_CODE[code]?.name ?? code) : "Seleção a definir";
}

export function getMockProfileName(id: string, requestedName?: string | null) {
  if (requestedName?.trim()) return requestedName.trim();
  if (id === "me") return "Paulo Rosado";

  return PARTICIPANTS.find((participant) => participant.id === id)?.name ?? "Participante do Bolão";
}

export function buildMockProfile(
  id: string,
  requestedName?: string | null,
  requestedPoints?: number | null,
): MockProfile {
  const seed = hash(id);
  const completed = ALL_FIXTURES.filter((fixture) => fixture.result && !fixture.live);
  const open = ALL_FIXTURES.filter((fixture) => !fixture.result || fixture.live);
  const completedStart = seed % Math.max(1, completed.length - 10);
  const selectedOpen = open.slice(0, 6);
  const usedFixtures = new Set<string>();

  const completedGuesses = Array.from({ length: 10 }, (_, index) => {
    const desiredOutcome = OUTCOMES[(index + seed) % OUTCOMES.length];

    for (let offset = 0; offset < completed.length; offset += 1) {
      const fixture = completed[(completedStart + index + offset) % completed.length];
      if (usedFixtures.has(fixture.id)) continue;

      const result = fixture.result as Score;
      const guess = findGuess(result, desiredOutcome, seed + index);
      if (!guess) continue;

      usedFixtures.add(fixture.id);
      return {
        fixture,
        guess,
        result,
        outcome: desiredOutcome,
        points: pointsFor(desiredOutcome),
      };
    }

    throw new Error(`Não foi possível gerar um palpite mockado para ${desiredOutcome}.`);
  });

  const guesses: MockProfileGuess[] = [
    ...completedGuesses,
    ...selectedOpen.map((fixture, index) => ({
      fixture,
      guess: {
        home: (seed + index * 2) % 4,
        away: (seed + index * 3 + 1) % 4,
      },
      result: null,
      outcome: null,
      points: null,
    })),
  ].sort((a, b) => b.fixture.kickoff.localeCompare(a.fixture.kickoff));

  const stats: Record<GuessOutcome, number> = {
    chinelada: 0,
    strong: 0,
    result: 0,
    goals: 0,
    miss: 0,
  };

  for (const guess of guesses) {
    if (guess.outcome) stats[guess.outcome] += 1;
  }

  return {
    id,
    name: getMockProfileName(id, requestedName),
    points: requestedPoints ?? guesses.reduce((total, guess) => total + (guess.points ?? 0), 0),
    stats,
    guesses,
  };
}

export function getFixtureTeams(fixture: Fixture) {
  return {
    home: teamName(fixture.homeCode),
    away: teamName(fixture.awayCode),
  };
}
