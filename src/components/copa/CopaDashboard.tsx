"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, CircleDot, Grid3X3, Network, Sparkles, Trophy } from "lucide-react";

import { SelectionLink } from "@/components/common/SelectionLink";
import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import {
  buildKnockoutBracket,
  groupStandings,
  sortStandings,
  type GrupoRow,
  type JogoGrupo,
  type KnockoutBracket,
  type KnockoutMatch,
  type Standing,
  type TeamSlot,
} from "@/lib/knockout";
import { cn } from "@/lib/utils";

type View = "grupos" | "mata-mata";
type GrupoApiRow = GrupoRow & { updated_at?: string };

export function CopaDashboard({
  initialGrupos = [],
  initialJogos = [],
}: {
  initialGrupos?: GrupoApiRow[];
  initialJogos?: JogoGrupo[];
}) {
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const view: View = searchParams.get("visao") === "mata-mata" ? "mata-mata" : "grupos";
  const hasInitialData = initialGrupos.length > 0 || initialJogos.length > 0;
  const [grupos, setGrupos] = useState<GrupoApiRow[]>(initialGrupos);
  const [jogos, setJogos] = useState<JogoGrupo[]>(initialJogos);
  const [loading, setLoading] = useState(!hasInitialData);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/grupos", { cache: "no-store" });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível carregar os dados da Copa.");
      }

      setGrupos(body.grupos ?? []);
      setJogos(body.jogos ?? []);
      setError(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível carregar os dados da Copa.",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      await loadData();
      if (active) setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [loadData]);

  useRealtimeRefresh({
    channelName: "copa-live",
    signals: ["jogos", "grupos"],
    onRefresh: loadData,
  });

  const groups = useMemo(() => groupStandings(grupos, jogos), [grupos, jogos]);
  const thirds = useMemo(
    () =>
      groups
        .map(({ standings }) => standings[2])
        .filter(Boolean)
        .sort((a, b) => sortStandings(a, b, jogos)),
    [groups, jogos],
  );
  const bracket = useMemo(() => buildKnockoutBracket(grupos, jogos), [grupos, jogos]);
  const finishedGames = useMemo(
    () => jogos.filter((jogo) => jogo.gols1 != null && jogo.gols2 != null).length,
    [jogos],
  );

  return (
    <>
      <CopaHero finishedGames={finishedGames} />
      <ViewSwitcher view={view} />

      {error && (
        <div className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <ViewSkeleton view={view} />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            {view === "grupos" ? (
              <GroupsView groups={groups} thirds={thirds} />
            ) : (
              <BracketView bracket={bracket} />
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
}

function CopaHero({ finishedGames }: { finishedGames: number }) {
  return (
    <header className="relative mb-4 overflow-hidden rounded-2xl border border-primary/30 bg-card">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,color-mix(in_oklab,var(--primary)_24%,transparent),transparent_34%)]" />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Caminho até a taça
          </div>
          <h2 className="max-w-2xl font-display text-3xl font-black leading-none tracking-tight sm:text-4xl">
            Da fase de grupos à final.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Acompanhe quem avança e veja a chave se montar automaticamente com a classificação
            atual.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
          <HeroStat value="12" label="grupos" />
          <HeroStat value="32" label="avançam" />
          <HeroStat value={`${finishedGames}/72`} label="resultados" />
        </div>
      </div>
    </header>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-background/55 px-3 py-3 text-center backdrop-blur">
      <div className="font-display text-xl font-black text-primary num sm:text-2xl">{value}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[10px]">
        {label}
      </div>
    </div>
  );
}

function ViewSwitcher({ view }: { view: View }) {
  const reduceMotion = useReducedMotion();
  const items = [
    {
      value: "grupos" as const,
      href: "/grupos?visao=grupos",
      label: "Classificação",
      description: "12 grupos e melhores terceiros",
      icon: Grid3X3,
    },
    {
      value: "mata-mata" as const,
      href: "/grupos?visao=mata-mata",
      label: "Chave",
      description: "Dos 16-avos até a final",
      icon: Network,
    },
  ];

  return (
    <div className="sticky top-[59px] z-30 -mx-3 mb-6 border-y border-border/70 bg-background/90 px-3 py-2 backdrop-blur-xl sm:top-[65px] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:rounded-2xl lg:border lg:bg-card/85 lg:p-1.5">
      <nav className="mx-auto grid max-w-3xl grid-cols-2 gap-1.5" aria-label="Visões da Copa">
        {items.map(({ value, href, label, description, icon: Icon }) => {
          const active = view === value;
          return (
            <Link
              key={value}
              href={href}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3",
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="copa-view-tab"
                  className="absolute inset-0 rounded-xl bg-primary shadow-[0_8px_24px_-14px_var(--primary)]"
                  transition={{
                    duration: reduceMotion ? 0 : 0.18,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              )}
              <span
                className={cn(
                  "relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                  active
                    ? "border-primary-foreground/20 bg-primary-foreground/10"
                    : "border-border bg-background/60",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="relative z-10 min-w-0">
                <span className="block truncate font-display text-sm font-black sm:text-base">
                  {label}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-[11px] min-[390px]:block",
                    active ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {description}
                </span>
              </span>
              <ArrowRight
                className={cn(
                  "relative z-10 ml-auto hidden h-4 w-4 shrink-0 transition-transform sm:block",
                  active && "translate-x-0.5",
                )}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function GroupsView({
  groups,
  thirds,
}: {
  groups: { group: string; standings: Standing[] }[];
  thirds: Standing[];
}) {
  return (
    <div>
      <SectionHeader
        eyebrow="Primeira fase"
        title="Classificação dos grupos"
        description="Os dois primeiros avançam direto. Os oito melhores terceiros completam a chave."
      >
        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
          <Legend tone="primary" label="Avança" />
          <Legend tone="warning" label="Ranking de 3º" />
        </div>
      </SectionHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groups.map(({ group, standings }) => (
          <GroupCard key={group} group={group} standings={standings} />
        ))}
      </div>

      <ThirdsRanking thirds={thirds} />
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </p>
        <h3 className="font-display text-2xl font-black tracking-tight">{title}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Legend({ tone, label }: { tone: "primary" | "warning"; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5">
      <span
        className={cn("h-2 w-2 rounded-full", tone === "primary" ? "bg-primary" : "bg-warning")}
      />
      {label}
    </span>
  );
}

function GroupCard({ group, standings }: { group: string; standings: Standing[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_12px_35px_-30px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/12 to-transparent px-3 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-display text-lg font-black text-primary-foreground">
          {group}
        </span>
        <div>
          <h4 className="font-display font-black">Grupo {group}</h4>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {standings.length} seleções
          </p>
        </div>
        <div className="ml-auto grid grid-cols-[24px_30px_34px] gap-1 text-right text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          <span>J</span>
          <span>P</span>
          <span>SG</span>
        </div>
      </div>

      <ol className="divide-y divide-border/75">
        {standings.map((standing, index) => {
          const direct = index < 2;
          const third = index === 2;
          return (
            <li
              key={standing.time}
              className={cn(
                "relative grid grid-cols-[26px_minmax(0,1fr)_24px_30px_34px] items-center gap-1 px-3 py-2.5 text-sm",
                direct && "bg-primary/[0.07]",
                third && "bg-warning/[0.06]",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-md font-display text-[11px] font-black",
                  direct && "bg-primary text-primary-foreground",
                  third && "bg-warning text-primary-foreground",
                  !direct && !third && "bg-muted text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <SelectionLink
                name={standing.time}
                flagSize="sm"
                className="max-w-full"
                nameClassName={cn("text-[12px]", direct && "font-bold")}
              />
              <span className="num text-right text-xs text-muted-foreground">{standing.jogos}</span>
              <span className="num text-right font-black">{standing.pontuacao}</span>
              <span className="num text-right text-xs text-muted-foreground">
                {formatSigned(standing.saldo_gols)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ThirdsRanking({ thirds }: { thirds: Standing[] }) {
  return (
    <section className="mt-10">
      <SectionHeader
        eyebrow="Últimas vagas"
        title="Corrida dos terceiros"
        description="A linha de corte fica depois da oitava posição, usando pontos, confronto direto, saldo e gols pró."
      >
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
          8 vagas
        </span>
      </SectionHeader>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[30px_minmax(0,1fr)_32px_38px_70px] items-center gap-1.5 border-b border-border bg-background/45 px-2.5 py-2.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground sm:grid-cols-[48px_minmax(0,1fr)_70px_54px_54px_54px_120px] sm:gap-2 sm:px-5">
          <span>#</span>
          <span>Seleção</span>
          <span className="hidden sm:block">Grupo</span>
          <span className="text-right">J</span>
          <span className="text-right">P</span>
          <span className="hidden text-right sm:block">SG</span>
          <span className="text-right">Situação</span>
        </div>

        <ol className="divide-y divide-border">
          {thirds.map((standing, index) => {
            const classified = index < 8;
            return (
              <Fragment key={`${standing.grupo}-${standing.time}`}>
                {index === 8 && (
                  <li className="flex items-center gap-3 border-y border-destructive/30 bg-destructive/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-destructive sm:px-5">
                    <span className="h-px flex-1 bg-destructive/30" />
                    Linha de corte
                    <span className="h-px flex-1 bg-destructive/30" />
                  </li>
                )}
                <li
                  className={cn(
                    "grid grid-cols-[30px_minmax(0,1fr)_32px_38px_70px] items-center gap-1.5 px-2.5 py-2.5 text-xs sm:grid-cols-[48px_minmax(0,1fr)_70px_54px_54px_54px_120px] sm:gap-2 sm:px-5 sm:text-sm",
                    classified ? "bg-primary/[0.055]" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "font-display text-base font-black num",
                      classified ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <SelectionLink
                      name={standing.time}
                      flagSize="sm"
                      className="max-w-full"
                      nameClassName="font-semibold"
                    />
                    <span className="min-w-0">
                      <span className="text-[9px] uppercase tracking-wider sm:hidden">
                        Grupo {standing.grupo} · SG {formatSigned(standing.saldo_gols)}
                      </span>
                    </span>
                  </span>
                  <span className="hidden font-bold sm:block">{standing.grupo}</span>
                  <span className="num text-right">{standing.jogos}</span>
                  <span className="num text-right font-black text-foreground">
                    {standing.pontuacao}
                  </span>
                  <span className="hidden text-right sm:block">
                    {formatSigned(standing.saldo_gols)}
                  </span>
                  <span className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider",
                        classified
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {classified && <Check className="h-3 w-3" />}
                      <span className="sm:hidden">{classified ? "Dentro" : "Fora"}</span>
                      <span className="hidden sm:inline">
                        {classified ? "Classificado" : "Fora"}
                      </span>
                    </span>
                  </span>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function BracketView({ bracket }: { bracket: KnockoutBracket }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const rounds = [
    { title: "16-avos", subtitle: "32 seleções", matches: bracket.r32 },
    { title: "Oitavas", subtitle: "16 seleções", matches: bracket.r16 },
    { title: "Quartas", subtitle: "8 seleções", matches: bracket.quartas },
    { title: "Semifinais", subtitle: "4 seleções", matches: bracket.semifinais },
    { title: "Final", subtitle: "A taça", matches: [bracket.final] },
  ];

  function selectRound(roundIndex: number) {
    setSelectedRound(roundIndex);

    const container = scrollContainerRef.current;
    if (!container) return;

    const target = container.querySelector<HTMLElement>(`[data-bracket-round="${roundIndex}"]`);
    if (!target) return;

    const left = target.offsetLeft - (container.clientWidth - target.offsetWidth) / 2;
    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    container.scrollTo({
      left: Math.min(Math.max(0, left), maxLeft),
      behavior: "smooth",
    });
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Fase eliminatória"
        title="Chave projetada"
        description="Os confrontos dos 16-avos refletem a classificação acima e a matriz oficial dos melhores terceiros."
      />

      <div className="mb-6 overflow-hidden rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/14 via-card to-card p-4 ring-yellow sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.75fr)] lg:items-center">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground sm:h-14 sm:w-14">
              <Network className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                Projeção atual
              </p>
              <h4 className="mt-1 font-display text-lg font-black leading-tight sm:text-2xl">
                32 classificados, um caminho até a final
              </h4>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Matriz dos terceiros:{" "}
                <strong className="text-foreground">{bracket.matrizKey ?? "em definição"}</strong>
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              Melhores terceiros na chave
            </p>
            <div className="flex flex-wrap gap-1.5">
              {bracket.terceirosClassificados.map((team) => (
                <span
                  key={`${team.grupo}-${team.time}`}
                  className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-background/60 px-2 py-1 text-[10px] font-bold"
                >
                  <span className="text-primary">3{team.grupo}</span>
                  <span className="max-w-24 truncate">{team.time}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="-mx-3 overflow-x-auto px-3 pb-5 pt-1 [scrollbar-width:thin] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
      >
        <div className="flex min-w-fit items-stretch gap-4 sm:gap-5">
          {rounds.map((round, index) => (
            <Round
              key={round.title}
              index={index + 1}
              scrollIndex={index}
              selected={selectedRound === index}
              onSelect={() => selectRound(index)}
              {...round}
            />
          ))}
        </div>
      </div>

      <section className="mt-6 max-w-md">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-black uppercase tracking-wider">
            Disputa de 3º lugar
          </h3>
        </div>
        <MatchCard match={bracket.terceiro} />
      </section>
    </div>
  );
}

function Round({
  index,
  title,
  subtitle,
  matches,
  scrollIndex,
  selected,
  onSelect,
}: {
  index: number;
  title: string;
  subtitle: string;
  matches: KnockoutMatch[];
  scrollIndex: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <section
      data-bracket-round={scrollIndex}
      className="flex w-[calc(100vw-2.5rem)] max-w-[286px] shrink-0 snap-start flex-col sm:w-[272px]"
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "relative mb-3 flex cursor-pointer items-center rounded-xl border px-3 py-2.5 text-left transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card/95",
        )}
      >
        <span
          className={cn(
            "mr-2 grid h-7 w-7 place-items-center rounded-lg font-display text-xs font-black",
            selected ? "bg-primary-foreground/15" : "bg-primary/12 text-primary",
          )}
        >
          {index}
        </span>
        <span>
          <span className="block font-display text-sm font-black">{title}</span>
          <span
            className={cn(
              "block text-[9px] uppercase tracking-wider",
              selected ? "text-primary-foreground/65" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </span>
        </span>
        <span className="ml-auto text-[10px] font-bold opacity-70">
          {matches.length} {matches.length === 1 ? "jogo" : "jogos"}
        </span>
      </button>

      <div className="flex flex-1 flex-col justify-around gap-3">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} onClick={onSelect} />
        ))}
      </div>
    </section>
  );
}

function MatchCard({ match, onClick }: { match: KnockoutMatch; onClick?: () => void }) {
  const isFinal = match.fase === "Final";
  const content = (
    <>
      <div className="flex items-center justify-between border-b border-border/70 bg-background/35 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
        <span>{match.id}</span>
        <span>{match.fase}</span>
      </div>
      <div className="px-3 py-2.5">
        <TeamSide team={match.time1} fallback={match.label1} />
        <div className="my-2 flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[8px] font-black uppercase text-muted-foreground">x</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <TeamSide team={match.time2} fallback={match.label2} />
      </div>
    </>
  );
  const className = cn(
    "w-full overflow-hidden rounded-xl border bg-card text-left shadow-[0_14px_30px_-28px_rgba(0,0,0,0.95)]",
    isFinal ? "border-primary ring-yellow" : "border-border",
    onClick &&
      "cursor-pointer transition-[border-color,box-shadow] hover:border-primary/60 hover:shadow-[0_18px_34px_-24px_rgba(0,0,0,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );

  if (onClick) {
    return (
      <article
        role="button"
        tabIndex={0}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a, button, input, select, textarea")) return;
          onClick();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onClick();
        }}
        className={className}
      >
        {content}
      </article>
    );
  }

  return <article className={className}>{content}</article>;
}

function TeamSide({ team, fallback }: { team: TeamSlot | null; fallback: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", !team && "text-muted-foreground")}>
      {team ? (
        <SelectionLink
          name={team.time}
          flagSize="md"
          className="max-w-[min(100%,11rem)]"
          nameClassName="font-bold"
        />
      ) : (
        <span className="grid h-5 w-8 shrink-0 place-items-center rounded bg-muted">
          <CircleDot className="h-3 w-3" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {!team ? <p className="truncate text-sm">{fallback}</p> : null}
        {team && (
          <p className="mt-0.5 truncate text-[9px] uppercase tracking-wider text-muted-foreground">
            {team.posicao}º do Grupo {team.grupo} · {team.pontuacao} pts
          </p>
        )}
      </div>
      {team && (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/12 font-display text-[10px] font-black text-primary">
          {team.posicao}
          {team.grupo}
        </span>
      )}
    </div>
  );
}

function ViewSkeleton({ view }: { view: View }) {
  return (
    <SpinningBallLoader
      label={view === "grupos" ? "Carregando grupos" : "Carregando mata-mata"}
      className="min-h-[360px]"
    />
  );
}

export function CopaDashboardSkeleton() {
  return <SpinningBallLoader label="Carregando dados da Copa" className="min-h-[520px]" />;
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : value;
}
