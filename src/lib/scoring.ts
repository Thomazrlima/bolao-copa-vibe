import type { Score } from "@/data/fixtures";

export const POINTS = {
  exact: 5,
  partial: 2,
  miss: 0,
};

export type GuessOutcome = "exact" | "partial" | "miss";

export function compareGuess(guess: Score, real: Score): GuessOutcome {
  if (guess.home === real.home && guess.away === real.away) return "exact";
  const gw = Math.sign(guess.home - guess.away);
  const rw = Math.sign(real.home - real.away);
  if (gw === rw) return "partial";
  return "miss";
}

export function pointsFor(o: GuessOutcome) {
  return POINTS[o];
}
