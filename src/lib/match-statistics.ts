export type MatchStatistic = {
  name: string;
  home: number | null;
  away: number | null;
};

const STATISTIC_LABELS: Record<string, string> = {
  "shots on goal": "Finalizações no gol",
  "shots off goal": "Finalizações para fora",
  "total shots": "Finalizações",
  "blocked shots": "Finalizações bloqueadas",
  "shots insidebox": "Finalizações na área",
  "shots outsidebox": "Finalizações fora da área",
  fouls: "Faltas",
  "corner kicks": "Escanteios",
  offsides: "Impedimentos",
  "ball possession": "Posse de bola",
  "yellow cards": "Cartões amarelos",
  "red cards": "Cartões vermelhos",
  "goalkeeper saves": "Defesas do goleiro",
  "total passes": "Passes",
  "passes accurate": "Passes certos",
  "passes %": "Precisão dos passes",
  expected_goals: "Gols esperados (xG)",
  goals_prevented: "Gols evitados",
};

const STATISTIC_ORDER = [
  "total shots",
  "shots on goal",
  "shots off goal",
  "blocked shots",
  "shots insidebox",
];

const STATISTIC_ORDER_INDEX = new Map(
  STATISTIC_ORDER.map((name, index) => [normalizeStatisticName(name), index]),
);

export function orderStatistics<T extends { name: string }>(statistics: T[]) {
  return [...statistics].sort((statisticA, statisticB) => {
    const orderA = STATISTIC_ORDER_INDEX.get(normalizeStatisticName(statisticA.name));
    const orderB = STATISTIC_ORDER_INDEX.get(normalizeStatisticName(statisticB.name));

    if (orderA != null && orderB != null) return orderA - orderB;
    if (orderA != null) return -1;
    if (orderB != null) return 1;
    return 0;
  });
}

export function getStatisticLabel(name: string) {
  return STATISTIC_LABELS[normalizeStatisticName(name)] ?? name;
}

export function normalizeStatisticName(name: string) {
  return name.trim().toLowerCase();
}

export function formatStatisticValue(name: string, value: number | null) {
  if (value == null) return "-";

  const normalizedName = normalizeStatisticName(name);
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);

  return normalizedName === "ball possession" || normalizedName === "passes %"
    ? `${formatted}%`
    : formatted;
}
