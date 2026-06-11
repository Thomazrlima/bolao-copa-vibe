import { GROUPS, teamsByGroup, type GroupKey, type Team } from "@/data/teams";
import { GROUP_FIXTURES } from "@/data/fixtures";
import type { Score } from "@/data/fixtures";

export type Standing = {
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  group: GroupKey;
};

export function computeGroupStandings(
  group: GroupKey,
  results: Record<string, Score | null>,
): Standing[] {
  const teams = teamsByGroup(group);
  const map = new Map<string, Standing>();
  teams.forEach((t) =>
    map.set(t.code, {
      team: t,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
      group,
    }),
  );
  GROUP_FIXTURES.filter((f) => f.group === group).forEach((f) => {
    const r = results[f.id];
    if (!r || !f.homeCode || !f.awayCode) return;
    const h = map.get(f.homeCode)!;
    const a = map.get(f.awayCode)!;
    h.played++;
    a.played++;
    h.gf += r.home;
    h.ga += r.away;
    a.gf += r.away;
    a.ga += r.home;
    if (r.home > r.away) {
      h.wins++;
      h.points += 3;
      a.losses++;
    } else if (r.home < r.away) {
      a.wins++;
      a.points += 3;
      h.losses++;
    } else {
      h.draws++;
      a.draws++;
      h.points++;
      a.points++;
    }
  });
  map.forEach((s) => (s.gd = s.gf - s.ga));
  return [...map.values()].sort(sortStandings);
}

export function sortStandings(a: Standing, b: Standing) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.team.rank - b.team.rank;
}

export function allGroupStandings(results: Record<string, Score | null>) {
  return GROUPS.map((g) => ({
    group: g as GroupKey,
    standings: computeGroupStandings(g as GroupKey, results),
  }));
}

export function bestThirds(results: Record<string, Score | null>): Standing[] {
  const all = allGroupStandings(results)
    .map((g) => g.standings[2])
    .filter(Boolean);
  return all.sort(sortStandings);
}
