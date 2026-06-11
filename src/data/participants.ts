import { GROUP_FIXTURES } from "./fixtures";

export type Participant = {
  id: string;
  name: string;
  initials: string;
  color: string; // tailwind bg class
  // map fixtureId -> guess
  guesses: Record<string, { home: number; away: number }>;
};

const PEOPLE: { name: string; color: string }[] = [
  { name: "Lucas Andrade", color: "bg-yellow-500/30 text-yellow-200" },
  { name: "Mariana Costa", color: "bg-amber-500/30 text-amber-200" },
  { name: "Rafael Souza", color: "bg-orange-500/30 text-orange-200" },
  { name: "Camila Rocha", color: "bg-yellow-400/30 text-yellow-100" },
  { name: "Pedro Henrique", color: "bg-amber-400/30 text-amber-100" },
  { name: "Beatriz Lima", color: "bg-lime-500/30 text-lime-200" },
  { name: "Gustavo Pereira", color: "bg-yellow-600/30 text-yellow-100" },
  { name: "Juliana Martins", color: "bg-amber-600/30 text-amber-100" },
  { name: "Thiago Almeida", color: "bg-orange-600/30 text-orange-100" },
  { name: "Fernanda Dias", color: "bg-yellow-300/30 text-yellow-50" },
  { name: "Bruno Carvalho", color: "bg-amber-300/30 text-amber-50" },
  { name: "Aline Ribeiro", color: "bg-orange-300/30 text-orange-50" },
];

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const PARTICIPANTS: Participant[] = PEOPLE.map((p, i) => {
  const r = rand(i * 137 + 11);
  const guesses: Record<string, { home: number; away: number }> = {};
  GROUP_FIXTURES.forEach((f) => {
    guesses[f.id] = {
      home: Math.floor(r() * 4),
      away: Math.floor(r() * 4),
    };
  });
  return {
    id: `u${i + 1}`,
    name: p.name,
    initials: initials(p.name),
    color: p.color,
    guesses,
  };
});
