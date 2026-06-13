"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";

import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { UserAvatar } from "@/components/common/UserAvatar";
import { getDisplayName } from "@/lib/display-name";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { getRanking, type RankingUsuario } from "@/lib/queries";
import { cn } from "@/lib/utils";

type ParticipantTitle = {
  emoji?: string;
  label?: string;
  description: string;
  tone?: "gold" | "silver" | "bronze" | "danger";
};

const PODIUM_TITLES: Record<1 | 2 | 3, ParticipantTitle[]> = {
  1: [
    {
      emoji: "🔮",
      label: "Mãe Diná",
      description: "Líder do ranking",
      tone: "gold",
    },
  ],
  2: [
    {
      emoji: "👃",
      label: "No Cangote",
      description: "Segundo colocado",
      tone: "silver",
    },
  ],
  3: [
    {
      emoji: "😎",
      label: "Pódio é Pódio",
      description: "Terceiro colocado",
      tone: "bronze",
    },
  ],
};

const LAST_PLACE_TITLE: ParticipantTitle = {
  emoji: "🔦",
  description: "Lanterna do ranking",
  tone: "danger",
};
const LAST_PLACE_TITLES = [LAST_PLACE_TITLE];
const NO_TITLES: ParticipantTitle[] = [];

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRanking = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      setRanking(await getRanking());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível carregar o ranking.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRanking({ showLoading: true });
  }, [loadRanking]);

  useRealtimeRefresh({
    channelName: "ranking-live",
    signals: ["ranking"],
    onRefresh: loadRanking,
  });

  const podium = useMemo(() => ranking.slice(0, 3), [ranking]);
  const rest = useMemo(() => ranking.slice(3), [ranking]);
  const chineladaLeaderId = useMemo(() => {
    if (ranking.length === 0) return null;

    const highestCount = Math.max(...ranking.map((participant) => participant.chineladas));
    const leaders = ranking.filter((participant) => participant.chineladas === highestCount);

    return leaders.length === 1 ? leaders[0].id : null;
  }, [ranking]);
  const relegationCount = Math.min(8, rest.length);
  const firstRelegatedPosition = ranking.length - relegationCount + 1;

  return (
    <>
      <PageHeader title="Ranking Geral" />

      {loading ? (
        <RankingSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center text-sm text-destructive">
          {error}
        </div>
      ) : (
        <>
          <Podium ranking={podium} chineladaLeaderId={chineladaLeaderId} />

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[32px_minmax(0,1fr)_46px_52px] items-center gap-1.5 border-b border-border bg-background/40 px-2 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:grid-cols-[64px_minmax(0,1fr)_100px_120px] sm:gap-2 sm:px-5 sm:py-3 sm:text-xs">
              <span>#</span>
              <span>Participante</span>
              <span className="text-right">
                <span className="sm:hidden">Chin.</span>
                <span className="hidden sm:inline">Chineladas</span>
              </span>
              <span className="text-right">Pts</span>
            </div>
            <ul className="divide-y divide-border">
              {rest.map((row, i) => {
                const pos = i + 4;
                const relegated = pos >= firstRelegatedPosition;

                return (
                  <Fragment key={row.id}>
                    {pos === firstRelegatedPosition && (
                      <li className="relegation-alert-strong border-y border-destructive/60 bg-destructive/25 px-2 py-2.5 text-[9px] font-black uppercase tracking-wider text-destructive sm:px-5 sm:text-[10px]">
                        Zona de Rebaixamento · últimos {relegationCount}
                      </li>
                    )}
                    <RankingRow
                      row={row}
                      pos={pos}
                      relegated={relegated}
                      lastPlace={pos === ranking.length}
                      chineladaLeaderId={chineladaLeaderId}
                    />
                  </Fragment>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </>
  );
}

function RankingRow({
  row,
  pos,
  relegated,
  lastPlace,
  chineladaLeaderId,
}: {
  row: RankingUsuario;
  pos: number;
  relegated: boolean;
  lastPlace: boolean;
  chineladaLeaderId: string | null;
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-[32px_minmax(0,1fr)_46px_52px] items-center gap-1.5 px-2 py-3 text-sm sm:grid-cols-[64px_minmax(0,1fr)_100px_120px] sm:gap-2 sm:px-5 sm:py-4",
        relegated &&
          "relegation-alert border-destructive/25 bg-destructive/15 text-destructive-foreground first:border-t",
      )}
    >
      <span className="flex items-center gap-1">
        <span
          className={cn(
            "font-display text-lg font-black num",
            relegated ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {pos}
        </span>
      </span>
      <Link
        href={profileHref(row)}
        className="flex min-w-0 items-center gap-2 rounded-md outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring sm:gap-3"
        aria-label={`Abrir perfil de ${row.nome_completo}`}
      >
        <AvatarName
          name={row.nome_completo}
          avatarPath={row.avatar_url}
          className={relegated ? "bg-card text-destructive ring-destructive/60" : undefined}
        />
        <InlineParticipantName
          name={row.nome_completo}
          titles={lastPlace ? LAST_PLACE_TITLES : NO_TITLES}
        />
      </Link>
      <span
        className={cn("num text-right font-bold", relegated ? "text-destructive" : "text-primary")}
      >
        {row.chineladas}
      </span>
      <span className="num text-right font-bold">{row.pontos}</span>
    </li>
  );
}

function RankingSkeleton() {
  return <SpinningBallLoader label="Carregando ranking" />;
}

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function InlineParticipantName({ name, titles }: { name: string; titles: ParticipantTitle[] }) {
  const displayName = getDisplayName(name);
  const containerRef = useRef<HTMLSpanElement>(null);
  const nameMeasureRef = useRef<HTMLSpanElement>(null);
  const titlesMeasureRef = useRef<HTMLSpanElement>(null);
  const [showTitles, setShowTitles] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const nameMeasure = nameMeasureRef.current;
    const titlesMeasure = titlesMeasureRef.current;

    if (!container || !nameMeasure || !titlesMeasure || titles.length === 0) {
      setShowTitles(false);
      return;
    }

    const update = () => {
      const requiredWidth = nameMeasure.scrollWidth + titlesMeasure.scrollWidth + 4;
      setShowTitles(requiredWidth <= container.clientWidth);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);

    return () => observer.disconnect();
  }, [displayName, titles]);

  return (
    <span ref={containerRef} className="relative flex min-w-0 flex-1 items-center gap-1">
      <span className="min-w-0 truncate font-semibold">{displayName}</span>
      {showTitles && <ParticipantTitles titles={titles} variant="inline" />}

      <span className="pointer-events-none absolute invisible whitespace-nowrap" aria-hidden>
        <span ref={nameMeasureRef} className="font-semibold">
          {displayName}
        </span>
        <span ref={titlesMeasureRef} className="inline-flex pl-1">
          <ParticipantTitles titles={titles} variant="inline" />
        </span>
      </span>
    </span>
  );
}

function ParticipantTitles({
  titles,
  variant,
}: {
  titles: ParticipantTitle[];
  variant: "inline" | "stacked";
}) {
  if (titles.length === 0) return null;

  const toneClasses: Record<NonNullable<ParticipantTitle["tone"]>, string> = {
    gold: "border-primary/50 bg-primary/15 text-primary",
    silver: "border-zinc-300/40 bg-zinc-300/10 text-zinc-200",
    bronze: "border-amber-700/50 bg-amber-800/15 text-amber-500",
    danger: "border-destructive/50 bg-destructive/15 text-destructive",
  };

  return (
    <span
      className={cn(
        "flex min-w-0 items-center",
        variant === "inline" ? "shrink-0 gap-1" : "justify-center gap-1",
      )}
    >
      {titles.map((title) => (
        <span
          key={`${title.emoji ?? ""}-${title.label ?? title.description}`}
          className={cn(
            "inline-flex min-w-0 items-center justify-center gap-1",
            title.label &&
              "max-w-full rounded-full border px-2 py-1 text-[10px] font-bold leading-none sm:px-2.5 sm:text-[11px]",
            title.label && toneClasses[title.tone ?? "gold"],
          )}
          title={title.description}
        >
          {title.emoji && (
            <span
              className="shrink-0 text-sm leading-none"
              role="img"
              aria-label={title.description}
            >
              {title.emoji}
            </span>
          )}
          {title.label && <span className="truncate whitespace-nowrap">{title.label}</span>}
        </span>
      ))}
    </span>
  );
}

function Podium({
  ranking,
  chineladaLeaderId,
}: {
  ranking: RankingUsuario[];
  chineladaLeaderId: string | null;
}) {
  const reduceMotion = useReducedMotion();

  if (ranking.length < 3) return null;

  const [first, second, third] = ranking;
  const slots: Array<{ row: RankingUsuario; pos: 1 | 2 | 3 }> = [
    { row: second, pos: 2 },
    { row: first, pos: 1 },
    { row: third, pos: 3 },
  ];
  const heights: Record<1 | 2 | 3, string> = {
    1: "h-40 sm:h-52",
    2: "h-32 sm:h-40",
    3: "h-28 sm:h-32",
  };
  const labels: Record<1 | 2 | 3, string> = { 1: "1º", 2: "2º", 3: "3º" };
  const positionStyles: Record<1 | 2 | 3, string> = {
    1: "border-primary/70 bg-primary/20 text-primary shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_18%,transparent)]",
    2: "border-zinc-300/50 bg-zinc-300/10 text-zinc-200",
    3: "border-amber-700/60 bg-amber-800/15 text-amber-500",
  };
  const avatarStyles: Record<1 | 2 | 3, string> = {
    1: "bg-primary/20 text-primary ring-primary/70",
    2: "bg-zinc-300/15 text-zinc-200 ring-zinc-300/60",
    3: "bg-amber-800/20 text-amber-500 ring-amber-700/70",
  };

  return (
    <div className="mb-8 rounded-lg border border-border bg-card/60 p-2.5 min-[380px]:p-4 sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        <Trophy className="h-3.5 w-3.5 text-primary" /> Pódio
      </div>
      <div className="grid grid-cols-3 items-end gap-1.5 min-[380px]:gap-3 sm:gap-6">
        {slots.map(({ row, pos }, index) => (
          <motion.div
            key={row.id}
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: reduceMotion ? 0 : 0.45,
              delay: reduceMotion ? 0 : index * 0.12,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="group flex min-w-0 flex-col items-center text-center"
          >
            <Link
              href={profileHref(row)}
              className="mb-2 flex min-h-28 w-full flex-col items-center justify-end gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-32"
              aria-label={`Abrir perfil de ${row.nome_completo}`}
            >
              <motion.div
                className="relative"
                animate={
                  pos === 1 && !reduceMotion
                    ? {
                        y: [0, -4, 0],
                      }
                    : undefined
                }
                transition={
                  pos === 1
                    ? {
                        duration: 2.8,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }
                    : undefined
                }
              >
                {pos === 1 && (
                  <span
                    className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl leading-none sm:-top-5.5 sm:text-2xl"
                    role="img"
                    aria-label="Líder"
                  >
                    👑
                  </span>
                )}
                <AvatarName
                  name={row.nome_completo}
                  avatarPath={row.avatar_url}
                  large={pos === 1}
                  className={avatarStyles[pos]}
                />
              </motion.div>
              <span className="mt-1 line-clamp-2 w-full break-words text-[10px] font-semibold leading-4 min-[380px]:text-xs sm:text-sm">
                {getDisplayName(row.nome_completo)}
              </span>
              <ParticipantTitles titles={PODIUM_TITLES[pos]} variant="stacked" />
            </Link>
            <motion.div
              animate={
                pos === 1 && !reduceMotion
                  ? {
                      boxShadow: [
                        "0 0 16px color-mix(in oklab, var(--primary) 10%, transparent)",
                        "0 0 30px color-mix(in oklab, var(--primary) 28%, transparent)",
                        "0 0 16px color-mix(in oklab, var(--primary) 10%, transparent)",
                      ],
                    }
                  : undefined
              }
              transition={
                pos === 1
                  ? {
                      duration: 2.8,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }
                  : undefined
              }
              className={cn(
                "flex w-full min-w-0 flex-col items-center justify-between gap-1 rounded-t-md border border-b-0 px-1 py-2 font-display font-black sm:rounded-t-lg sm:px-2 sm:py-3",
                heights[pos],
                positionStyles[pos],
              )}
            >
              <span className={cn(pos === 1 ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl")}>
                {labels[pos]}
              </span>
              <span className="flex items-baseline justify-center gap-1">
                <span
                  className={cn(
                    "num leading-none",
                    pos === 1
                      ? "text-4xl text-foreground sm:text-6xl"
                      : "text-2xl text-foreground sm:text-4xl",
                  )}
                >
                  {row.pontos}
                </span>
                <span className="text-[8px] font-bold uppercase opacity-70 sm:text-[10px]">
                  pts
                </span>
              </span>
              <span className="max-w-full text-center text-[8px] font-bold uppercase leading-tight opacity-70 sm:text-[10px]">
                {row.chineladas} chin.
              </span>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function profileHref(row: RankingUsuario) {
  return `/perfil/${encodeURIComponent(row.id)}`;
}

function AvatarName({
  name,
  avatarPath,
  large,
  className,
}: {
  name: string;
  avatarPath: string | null;
  large?: boolean;
  className?: string;
}) {
  return (
    <UserAvatar
      name={name}
      avatarPath={avatarPath}
      className={cn(
        "shrink-0 bg-primary/20 ring-2 ring-primary/50",
        large ? "h-16 w-16 sm:h-20 sm:w-20" : "h-9 w-9",
        className,
      )}
      fallbackClassName={cn(
        "bg-primary/20 font-display font-black text-primary",
        large ? "text-xl sm:text-2xl" : "text-xs",
        className,
      )}
    />
  );
}
