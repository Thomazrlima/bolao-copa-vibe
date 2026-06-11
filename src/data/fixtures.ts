import { GROUPS, TEAMS, teamsByGroup, type GroupKey } from "./teams";
import { STADIUMS } from "./stadiums";

export type Score = { home: number; away: number };
export type MatchStage =
  | "group"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "third"
  | "final";

export type Fixture = {
  id: string;
  stage: MatchStage;
  group?: GroupKey;
  // For knockout slots, we resolve teams dynamically; group has fixed teams
  homeCode?: string;
  awayCode?: string;
  // ISO date string
  kickoff: string;
  stadium: string;
  // Real result (mock). null = não jogado ainda.
  result?: Score | null;
  // For live status mock
  live?: boolean;
};

// Deterministic pseudo-random
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const TOURNEY_START = new Date("2026-06-11T16:00:00Z"); // Thu

function dateAt(dayOffset: number, hourUTC: number) {
  const d = new Date(TOURNEY_START);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hourUTC, 0, 0, 0);
  return d.toISOString();
}

// Round-robin pairs (4 teams = 6 jogos)
const RR_PAIRS: [number, number][] = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

function buildGroupFixtures(): Fixture[] {
  const list: Fixture[] = [];
  GROUPS.forEach((g, gi) => {
    const teams = teamsByGroup(g as GroupKey);
    const r = rand(gi * 1000 + 7);
    RR_PAIRS.forEach((pair, i) => {
      const matchIndexGlobal = gi * 6 + i;
      const dayOffset = Math.floor(matchIndexGlobal / 4); // ~4 jogos por dia
      const hour = 14 + ((matchIndexGlobal % 4) * 3); // 14,17,20,23 UTC
      const stadium = STADIUMS[matchIndexGlobal % STADIUMS.length];
      // Mock: jogos antes de hoje (offset < 12) já têm resultado; offset 12 ao vivo; resto não iniciado
      let result: Score | null | undefined = null;
      let live = false;
      if (dayOffset < 12) {
        const strA = teams[pair[0]].rank;
        const strB = teams[pair[1]].rank;
        // time mais forte (rank menor) tende a marcar mais
        const baseA = Math.max(0, Math.round((50 - strA) / 18 + (r() - 0.3) * 1.6));
        const baseB = Math.max(0, Math.round((50 - strB) / 18 + (r() - 0.3) * 1.6));
        result = { home: baseA, away: baseB };
      } else if (dayOffset === 12) {
        result = { home: 1, away: 0 };
        live = true;
      } else {
        result = null;
      }
      list.push({
        id: `G-${g}-${i + 1}`,
        stage: "group",
        group: g as GroupKey,
        homeCode: teams[pair[0]].code,
        awayCode: teams[pair[1]].code,
        kickoff: dateAt(dayOffset, hour),
        stadium,
        result,
        live,
      });
    });
  });
  return list;
}

function buildKnockoutSlots(): Fixture[] {
  const list: Fixture[] = [];
  const stages: { stage: MatchStage; count: number; dayOffset: number }[] = [
    { stage: "r32", count: 16, dayOffset: 18 },
    { stage: "r16", count: 8, dayOffset: 22 },
    { stage: "qf", count: 4, dayOffset: 26 },
    { stage: "sf", count: 2, dayOffset: 29 },
    { stage: "third", count: 1, dayOffset: 31 },
    { stage: "final", count: 1, dayOffset: 32 },
  ];
  stages.forEach(({ stage, count, dayOffset }) => {
    for (let i = 1; i <= count; i++) {
      list.push({
        id: `${stage.toUpperCase()}-${i}`,
        stage,
        kickoff: dateAt(dayOffset + Math.floor((i - 1) / 4), 17 + ((i - 1) % 4) * 2),
        stadium: STADIUMS[(i + dayOffset) % STADIUMS.length],
        result: null,
      });
    }
  });
  return list;
}

export const GROUP_FIXTURES = buildGroupFixtures();
export const KO_FIXTURES = buildKnockoutSlots();
export const ALL_FIXTURES = [...GROUP_FIXTURES, ...KO_FIXTURES];

// Index helper
export const FIXTURE_BY_ID: Record<string, Fixture> = Object.fromEntries(
  ALL_FIXTURES.map((f) => [f.id, f]),
);

export function stageLabel(s: MatchStage): string {
  return {
    group: "Fase de Grupos",
    r32: "16-avos de Final",
    r16: "Oitavas de Final",
    qf: "Quartas de Final",
    sf: "Semifinal",
    third: "Disputa de 3º",
    final: "Final",
  }[s];
}
