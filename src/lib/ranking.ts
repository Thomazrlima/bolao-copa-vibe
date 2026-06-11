import { GROUP_FIXTURES } from "@/data/fixtures";
import { PARTICIPANTS, type Participant } from "@/data/participants";
import { compareGuess, pointsFor } from "./scoring";
import type { Score } from "@/data/fixtures";

export type ParticipantStats = {
  participant: Participant;
  exact: number;
  partial: number;
  miss: number;
  total: number;
};

export function statsFor(
  p: Participant,
  results: Record<string, Score | null>,
): ParticipantStats {
  let exact = 0, partial = 0, miss = 0, total = 0;
  GROUP_FIXTURES.forEach((f) => {
    const real = results[f.id];
    const guess = p.guesses[f.id];
    if (!real || !guess) return;
    const o = compareGuess(guess, real);
    if (o === "exact") exact++;
    else if (o === "partial") partial++;
    else miss++;
    total += pointsFor(o);
  });
  return { participant: p, exact, partial, miss, total };
}

export function rankParticipants(results: Record<string, Score | null>) {
  return PARTICIPANTS.map((p) => statsFor(p, results)).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.exact !== a.exact) return b.exact - a.exact;
    return a.participant.name.localeCompare(b.participant.name);
  });
}
