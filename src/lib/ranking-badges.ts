export type RankingBadgeKey =
  | "mae-dina"
  | "no-cangote"
  | "podio-e-podio"
  | "lanterna"
  | "chinelada";

export const RANKING_BADGES: Record<
  RankingBadgeKey,
  {
    emoji: string;
    label: string;
    description: string;
    className: string;
    tone: "gold" | "silver" | "bronze" | "danger";
  }
> = {
  "mae-dina": {
    emoji: "🔮",
    label: "Mãe Diná",
    description: "Líder do ranking.",
    className: "border-primary/45 bg-primary/10 text-primary",
    tone: "gold",
  },
  "no-cangote": {
    emoji: "👃",
    label: "No Cangote",
    description: "Segundo colocado do ranking.",
    className: "border-zinc-300/40 bg-zinc-300/10 text-zinc-200",
    tone: "silver",
  },
  "podio-e-podio": {
    emoji: "😎",
    label: "Pódio é Pódio",
    description: "Terceiro colocado do ranking.",
    className: "border-amber-700/50 bg-amber-800/15 text-amber-500",
    tone: "bronze",
  },
  lanterna: {
    emoji: "🔦",
    label: "Lanterna",
    description: "Último colocado do ranking.",
    className: "border-destructive/45 bg-destructive/10 text-destructive",
    tone: "danger",
  },
  chinelada: {
    emoji: "🩴",
    label: "Chinela de Ouro",
    description: "Maior número de chineladas do bolão, sem empate.",
    className: "border-primary/45 bg-primary/10 text-primary",
    tone: "gold",
  },
};

type RankingBadgeParticipant = {
  id: string;
  chineladas: number;
};

export function getRankingBadgeKeys(
  userId: string,
  ranking: RankingBadgeParticipant[],
): RankingBadgeKey[] {
  const badges: RankingBadgeKey[] = [];
  const position = ranking.findIndex((participant) => participant.id === userId) + 1;

  if (position === 1) badges.push("mae-dina");
  if (position === 2) badges.push("no-cangote");
  if (position === 3) badges.push("podio-e-podio");
  if (ranking.length > 0 && position === ranking.length) badges.push("lanterna");

  const highestChineladas = Math.max(0, ...ranking.map((participant) => participant.chineladas));
  const chineladaLeaders = ranking.filter(
    (participant) => participant.chineladas === highestChineladas,
  );

  if (highestChineladas > 0 && chineladaLeaders.length === 1 && chineladaLeaders[0].id === userId) {
    badges.push("chinelada");
  }

  return badges;
}
