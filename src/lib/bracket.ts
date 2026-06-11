import { allGroupStandings, bestThirds, type Standing } from "./standings";
import type { Score } from "@/data/fixtures";
import { TEAM_BY_CODE } from "@/data/teams";

export type BracketSlot = {
  id: string; // fixture id
  stage: "r32" | "r16" | "qf" | "sf" | "third" | "final";
  home?: Standing;
  away?: Standing;
  homeLabel: string; // e.g. "1A" or "V R32-1"
  awayLabel: string;
  result?: Score | null;
};

function winnerOf(slot: BracketSlot): Standing | undefined {
  const r = slot.result;
  if (!r || !slot.home || !slot.away) return undefined;
  if (r.home > r.away) return slot.home;
  if (r.away > r.home) return slot.away;
  // empate -> desempate por ranking
  return slot.home.team.rank <= slot.away.team.rank ? slot.home : slot.away;
}
function loserOf(slot: BracketSlot): Standing | undefined {
  const w = winnerOf(slot);
  if (!w) return undefined;
  return w === slot.home ? slot.away : slot.home;
}

export function computeBracket(results: Record<string, Score | null>) {
  // 1) Qualificados: 12 1ºs, 12 2ºs, 8 melhores 3ºs — todos juntos seedados por pontos
  const groups = allGroupStandings(results);
  const firsts = groups.map((g) => g.standings[0]).filter(Boolean);
  const seconds = groups.map((g) => g.standings[1]).filter(Boolean);
  const thirds = bestThirds(results).slice(0, 8);
  const qualifieds = [...firsts, ...seconds, ...thirds].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.rank - b.team.rank;
  });

  // 2) R32 — 16 partidas. Pareamento de chaveamento padrão (1v32, 2v31, ...).
  const r32: BracketSlot[] = [];
  for (let i = 1; i <= 16; i++) {
    const home = qualifieds[i - 1];
    const away = qualifieds[32 - i];
    r32.push({
      id: `R32-${i}`,
      stage: "r32",
      home,
      away,
      homeLabel: home ? `#${i}` : `#${i}`,
      awayLabel: away ? `#${33 - i}` : `#${33 - i}`,
      result: results[`R32-${i}`] ?? null,
    });
  }

  // 3) R16 — pares consecutivos
  const r16: BracketSlot[] = [];
  for (let i = 1; i <= 8; i++) {
    const a = r32[i * 2 - 2];
    const b = r32[i * 2 - 1];
    r16.push({
      id: `R16-${i}`,
      stage: "r16",
      home: winnerOf(a),
      away: winnerOf(b),
      homeLabel: `V ${a.id}`,
      awayLabel: `V ${b.id}`,
      result: results[`R16-${i}`] ?? null,
    });
  }

  // 4) QF
  const qf: BracketSlot[] = [];
  for (let i = 1; i <= 4; i++) {
    const a = r16[i * 2 - 2];
    const b = r16[i * 2 - 1];
    qf.push({
      id: `QF-${i}`,
      stage: "qf",
      home: winnerOf(a),
      away: winnerOf(b),
      homeLabel: `V ${a.id}`,
      awayLabel: `V ${b.id}`,
      result: results[`QF-${i}`] ?? null,
    });
  }

  // 5) SF
  const sf: BracketSlot[] = [];
  for (let i = 1; i <= 2; i++) {
    const a = qf[i * 2 - 2];
    const b = qf[i * 2 - 1];
    sf.push({
      id: `SF-${i}`,
      stage: "sf",
      home: winnerOf(a),
      away: winnerOf(b),
      homeLabel: `V ${a.id}`,
      awayLabel: `V ${b.id}`,
      result: results[`SF-${i}`] ?? null,
    });
  }

  // 6) Third + Final
  const third: BracketSlot = {
    id: "THIRD-1",
    stage: "third",
    home: loserOf(sf[0]),
    away: loserOf(sf[1]),
    homeLabel: "P SF-1",
    awayLabel: "P SF-2",
    result: results["THIRD-1"] ?? null,
  };
  const final: BracketSlot = {
    id: "FINAL-1",
    stage: "final",
    home: winnerOf(sf[0]),
    away: winnerOf(sf[1]),
    homeLabel: "V SF-1",
    awayLabel: "V SF-2",
    result: results["FINAL-1"] ?? null,
  };

  const champion = winnerOf(final)?.team ?? undefined;
  return { qualifieds, r32, r16, qf, sf, third, final, champion };
}

export function teamFromCode(code?: string) {
  return code ? TEAM_BY_CODE[code] : undefined;
}
