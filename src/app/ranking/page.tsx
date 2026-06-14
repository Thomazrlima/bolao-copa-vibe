"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, Radio, Trophy } from "lucide-react";

import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { BrazilThemedName } from "@/components/common/BrazilThemedName";
import { UserAvatar } from "@/components/common/UserAvatar";
import { getDisplayName } from "@/lib/display-name";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { getRanking, type RankingUsuario } from "@/lib/queries";
import { getRankingBadgeKeys, RANKING_BADGES, type RankingBadgeKey } from "@/lib/ranking-badges";
import { cn } from "@/lib/utils";

type ParticipantTitle = {
  emoji?: string;
  label?: string;
  description: string;
  tone?: "gold" | "silver" | "bronze" | "danger";
};

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
  const hasLiveRanking = ranking.some((participant) => participant.movimento === "partial");
  const relegationCount = Math.min(8, rest.length);
  const firstRelegatedPosition = ranking.length - relegationCount + 1;

  return (
    <div className="ranking-page">
      <PageHeader
        title="Ranking Geral"
        subtitle={hasLiveRanking ? "Ranking parcial atualizado com os placares ao vivo" : undefined}
        live={hasLiveRanking}
      />

      {loading ? (
        <RankingSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center text-sm text-destructive">
          {error}
        </div>
      ) : (
        <LayoutGroup id="ranking-geral">
          <Podium ranking={podium} fullRanking={ranking} />

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[58px_minmax(0,1fr)_46px_52px] items-center gap-1.5 border-b border-border bg-background/40 px-2 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:grid-cols-[96px_minmax(0,1fr)_100px_120px] sm:gap-2 sm:px-5 sm:py-3 sm:text-xs">
              <span>#</span>
              <span>Participante</span>
              <span className="text-right">
                <span className="sm:hidden">Chin.</span>
                <span className="hidden sm:inline">Chineladas</span>
              </span>
              <span className="text-right">
                <span className="sm:hidden">Pts</span>
                <span className="hidden sm:inline">Pontos</span>
              </span>
            </div>
            <ul className="divide-y divide-border">
              {rest.map((row) => {
                const pos = row.posicao;
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
                      badges={getRankingBadgeKeys(row.id, ranking)}
                    />
                  </Fragment>
                );
              })}
            </ul>
          </div>
        </LayoutGroup>
      )}
    </div>
  );
}

function RankingRow({
  row,
  pos,
  relegated,
  badges,
}: {
  row: RankingUsuario;
  pos: number;
  relegated: boolean;
  badges: RankingBadgeKey[];
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.li
      layout
      layoutId={`ranking-participant-${row.id}`}
      transition={{ layout: { duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] } }}
      className={cn(
        "grid grid-cols-[58px_minmax(0,1fr)_46px_52px] items-center gap-1.5 px-2 py-3 text-sm sm:grid-cols-[96px_minmax(0,1fr)_100px_120px] sm:gap-2 sm:px-5 sm:py-4",
        relegated &&
          "relegation-alert border-destructive/25 bg-destructive/15 text-destructive-foreground first:border-t",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            "font-display text-lg font-black num",
            relegated ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {pos}
        </span>
        <PositionMovement row={row} />
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
        <InlineParticipantName name={row.nome_completo} titles={badges.map(toParticipantTitle)} />
      </Link>
      <span
        className={cn("num text-right font-bold", relegated ? "text-destructive" : "text-primary")}
      >
        {row.chineladas}
      </span>
      <AnimatedNumber value={row.pontos} className="num text-right font-bold" />
    </motion.li>
  );
}

function RankingSkeleton() {
  return <SpinningBallLoader label="Carregando ranking" />;
}

function PageHeader({
  title,
  subtitle,
  live = false,
}: {
  title: string;
  subtitle?: string;
  live?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
      {subtitle && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-sm text-muted-foreground",
            live && "font-semibold text-primary",
          )}
        >
          {live && <Radio className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />}
          {subtitle}
        </p>
      )}
    </div>
  );
}

function PositionMovement({ row }: { row: RankingUsuario }) {
  if (!row.variacao || !row.movimento) return null;

  const wentUp = row.variacao > 0;
  const Icon = wentUp ? ArrowUp : ArrowDown;
  const amount = Math.abs(row.variacao);
  const partial = row.movimento === "partial";
  const label = `${wentUp ? "Subiu" : "Desceu"} ${amount} ${
    amount === 1 ? "posição" : "posições"
  }${partial ? " na parcial ao vivo" : ""}`;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={`${row.movimento}-${row.variacao}`}
        initial={{ opacity: 0, scale: 0.7, y: wentUp ? 4 : -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.7 }}
        transition={{ duration: 0.25 }}
        className={cn(
          "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] font-black leading-none sm:px-1.5 sm:text-xs",
          wentUp ? "text-success" : "text-destructive",
          partial && "border border-dashed border-current bg-background/60",
        )}
        title={label}
        aria-label={label}
      >
        <Icon className={cn("h-3 w-3", partial && "animate-pulse")} aria-hidden="true" />
        {amount}
      </motion.span>
    </AnimatePresence>
  );
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("relative inline-grid overflow-hidden", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22 }}
          className="col-start-1 row-start-1"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function InlineParticipantName({ name, titles }: { name: string; titles: ParticipantTitle[] }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <BrazilThemedName className="min-w-0 truncate font-semibold">
        {getDisplayName(name)}
      </BrazilThemedName>
      <ParticipantTitles titles={titles} variant="inline" />
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
        variant === "inline" ? "shrink-0 gap-1" : "flex-wrap justify-center gap-1",
      )}
    >
      {titles.map((title) => (
        <span
          key={`${title.emoji ?? ""}-${title.label ?? title.description}`}
          className={cn(
            "inline-flex min-w-0 items-center justify-center gap-1",
            title.label &&
              "max-w-full rounded-full border px-1.5 py-1 text-[10px] font-bold leading-none sm:px-2.5 sm:text-[11px]",
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
          {title.label && (
            <span
              className={cn(
                "truncate whitespace-nowrap",
                variant === "inline" && "hidden sm:inline",
              )}
            >
              {title.label}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function toParticipantTitle(badgeKey: RankingBadgeKey): ParticipantTitle {
  const badge = RANKING_BADGES[badgeKey];

  return {
    emoji: badge.emoji,
    label: badge.label,
    description: badge.description,
    tone: badge.tone,
  };
}

function Podium({
  ranking,
  fullRanking,
}: {
  ranking: RankingUsuario[];
  fullRanking: RankingUsuario[];
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
    1: "brazil-podium-position-1 border-primary/70 bg-primary/20 text-primary shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_18%,transparent)]",
    2: "brazil-podium-position-2 border-zinc-300/50 bg-zinc-300/10 text-zinc-200",
    3: "brazil-podium-position-3 border-amber-700/60 bg-amber-800/15 text-amber-500",
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
            layout
            layoutId={`ranking-participant-${row.id}`}
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: reduceMotion ? 0 : 0.45,
              delay: reduceMotion ? 0 : index * 0.12,
              ease: [0.22, 1, 0.36, 1],
              layout: { duration: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] },
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
                    className="absolute -top-5 left-1/2 z-10 -translate-x-1/2 text-xl leading-none sm:-top-5.5 sm:text-2xl"
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
                <BrazilThemedName>{getDisplayName(row.nome_completo)}</BrazilThemedName>
              </span>
              <ParticipantTitles
                titles={getRankingBadgeKeys(row.id, fullRanking).map(toParticipantTitle)}
                variant="stacked"
              />
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
              <span
                className={cn(
                  "flex items-center justify-center gap-1",
                  pos === 1 ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl",
                )}
              >
                {labels[pos]} <PositionMovement row={row} />
              </span>
              <span className="flex items-baseline justify-center gap-1">
                <AnimatedNumber
                  value={row.pontos}
                  className={cn(
                    "num leading-none",
                    pos === 1
                      ? "text-4xl text-foreground sm:text-6xl"
                      : "text-2xl text-foreground sm:text-4xl",
                  )}
                />
                <span className="text-[8px] font-bold uppercase opacity-70 sm:text-[10px]">
                  pts
                </span>
              </span>
              <span className="max-w-full text-center text-[8px] font-bold uppercase leading-tight opacity-70 sm:text-[10px]">
                {row.chineladas} {row.chineladas === 1 ? "chinelada" : "chineladas"}
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
