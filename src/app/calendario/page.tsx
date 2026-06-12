"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Radio,
  Sparkles,
  Trophy,
} from "lucide-react";

import { Flag } from "@/components/common/Flag";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teamCodeFromName } from "@/data/iso2";
import { getInitials } from "@/lib/display-name";
import { getPalpitesDoJogo, type JogoPalpitesResponse } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

type Jogo = {
  id: string;
  sportsdb_event_id: string | null;
  fase_id: number;
  time1: string;
  time2: string;
  data: string;
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
  rodada: number | null;
  sportsdb_status: string | null;
  sincronizado_em: string | null;
};

type GrupoRow = {
  grupo: string;
  time: string;
};

type StatusFilter = "all" | "today" | "live" | "finished";
type MatchState = "finished" | "live" | "today" | "future";

const FASE_LABEL: Record<number, string> = {
  1: "Fase de grupos",
  2: "16-avos",
  3: "Oitavas",
  4: "Quartas",
  5: "Semifinal",
  6: "Disputa de 3º",
  7: "Final",
};

const GROUPS = "ABCDEFGHIJKL".split("");

export default function CalendarioPage() {
  const mounted = useMounted();
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [grupos, setGrupos] = useState<GrupoRow[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [group, setGroup] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const loadData = useCallback(async () => {
    try {
      const [gamesResponse, groupsResponse] = await Promise.all([
        fetch("/api/jogos", { cache: "no-store" }),
        fetch("/api/grupos", { cache: "no-store" }),
      ]);
      const [gamesBody, groupsBody] = await Promise.all([
        gamesResponse.json(),
        groupsResponse.json(),
      ]);

      if (!gamesResponse.ok) {
        throw new Error(gamesBody.error ?? "Não foi possível carregar os jogos.");
      }
      if (!groupsResponse.ok) {
        throw new Error(groupsBody.error ?? "Não foi possível carregar os grupos.");
      }

      setJogos(gamesBody.jogos ?? []);
      setGrupos(groupsBody.grupos ?? []);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Não foi possível carregar o calendário.",
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

  useEffect(() => {
    if (!mounted) return;
    const interval = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [mounted]);

  const hasLiveGame = useMemo(() => {
    void nowTick;
    return jogos.some((jogo) => matchState(jogo) === "live");
  }, [jogos, nowTick]);

  useEffect(() => {
    if (!hasLiveGame) return;
    const interval = window.setInterval(loadData, 120_000);
    return () => window.clearInterval(interval);
  }, [hasLiveGame, loadData]);

  const groupByTeam = useMemo(() => new Map(grupos.map((row) => [row.time, row.grupo])), [grupos]);
  const todayKey = brasiliaTodayKey();

  const stats = useMemo(() => {
    void nowTick;
    return {
      finished: jogos.filter((jogo) => matchState(jogo) === "finished").length,
      today: jogos.filter((jogo) => brasiliaDateKey(jogo.data) === todayKey).length,
      live: jogos.filter((jogo) => matchState(jogo) === "live").length,
      total: jogos.length,
    };
  }, [jogos, nowTick, todayKey]);

  const filtered = useMemo(() => {
    void nowTick;
    return jogos.filter((jogo) => {
      const state = matchState(jogo);
      if (status === "today" && brasiliaDateKey(jogo.data) !== todayKey) return false;
      if (status === "live" && state !== "live") return false;
      if (status === "finished" && state !== "finished") return false;
      if (
        group !== "all" &&
        (jogo.fase_id !== 1 ||
          groupByTeam.get(jogo.time1) !== group ||
          groupByTeam.get(jogo.time2) !== group)
      ) {
        return false;
      }
      return true;
    });
  }, [group, groupByTeam, jogos, nowTick, status, todayKey]);

  const dates = useMemo(() => {
    const dateMap = new Map<string, Jogo[]>();
    filtered.forEach((jogo) => {
      const key = brasiliaDateKey(jogo.data);
      if (!dateMap.has(key)) dateMap.set(key, []);
      dateMap.get(key)!.push(jogo);
    });

    return [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => a.data.localeCompare(b.data)),
      }));
  }, [filtered]);

  if (!mounted) return <CalendarSkeleton />;

  return (
    <>
      <CalendarHero stats={stats} />
      <CalendarFilters status={status} group={group} onStatus={setStatus} onGroup={setGroup} />

      {error && (
        <div className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <CalendarSkeleton compact />
      ) : (
        <div>
          <SectionHeader
            eyebrow={group === "all" ? "Agenda completa" : `Grupo ${group}`}
            title={filterTitle(status, group)}
            description={`${filtered.length} jogo${filtered.length === 1 ? "" : "s"} encontrado${filtered.length === 1 ? "" : "s"} · horários de Brasília`}
          >
            <StatusLegend />
          </SectionHeader>

          <div className="space-y-8">
            {dates.map(({ date, items }) => (
              <DateSection key={date} date={date} jogos={items} groupByTeam={groupByTeam} />
            ))}
            {dates.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-muted-foreground">
                Nenhum jogo encontrado com os filtros atuais.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CalendarHero({
  stats,
}: {
  stats: { finished: number; today: number; live: number; total: number };
}) {
  return (
    <header className="relative mb-4 overflow-hidden rounded-2xl border border-primary/30 bg-card">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,color-mix(in_oklab,var(--primary)_24%,transparent),transparent_34%)]" />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />A bola não para
          </div>
          <h2 className="max-w-2xl font-display text-3xl font-black leading-none tracking-tight sm:text-4xl">
            Todos os jogos, do primeiro apito à final.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Acompanhe horários, placares e palpites da Copa em uma agenda organizada por dia.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:min-w-[460px]">
          <HeroStat value={stats.total} label="jogos" />
          <HeroStat value={stats.finished} label="encerrados" />
          <HeroStat value={stats.today} label="hoje" />
          <HeroStat value={stats.live} label="ao vivo" live={stats.live > 0} />
        </div>
      </div>
    </header>
  );
}

function HeroStat({ value, label, live }: { value: number; label: string; live?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background/55 px-2 py-3 text-center backdrop-blur sm:px-3",
        live ? "border-live/50 bg-live/10" : "border-border/80",
      )}
    >
      <div
        className={cn(
          "num font-display text-xl font-black sm:text-2xl",
          live ? "text-live" : "text-primary",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[10px]">
        {label}
      </div>
    </div>
  );
}

function CalendarFilters({
  status,
  group,
  onStatus,
  onGroup,
}: {
  status: StatusFilter;
  group: string;
  onStatus: (status: StatusFilter) => void;
  onGroup: (group: string) => void;
}) {
  const filters: Array<{ value: StatusFilter; label: string; icon: typeof CalendarDays }> = [
    { value: "all", label: "Todos", icon: CalendarDays },
    { value: "today", label: "Hoje", icon: Clock3 },
    { value: "live", label: "Ao vivo", icon: Radio },
    { value: "finished", label: "Encerrados", icon: CheckCircle2 },
  ];

  return (
    <div className="sticky top-[59px] z-30 -mx-3 mb-6 border-y border-border/70 bg-background/90 px-3 py-2 backdrop-blur-xl sm:top-[65px] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:rounded-2xl lg:border lg:bg-card/85 lg:p-1.5">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center">
        <div className="grid flex-1 grid-cols-4 gap-1">
          {filters.map(({ value, label, icon: Icon }) => {
            const active = status === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onStatus(value)}
                className={cn(
                  "flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors sm:text-xs",
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_8px_24px_-14px_var(--primary)]"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>

        <Select value={group} onValueChange={onGroup}>
          <SelectTrigger className="h-10 w-full rounded-xl border-border bg-background/60 font-bold sm:w-[190px]">
            <SelectValue placeholder="Todos os grupos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            {GROUPS.map((item) => (
              <SelectItem key={item} value={item}>
                Grupo {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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

function StatusLegend() {
  const items = [
    ["bg-live", "Ao vivo"],
    ["bg-primary", "Hoje"],
    ["bg-accent", "Próximos dias"],
    ["bg-muted-foreground", "Encerrado"],
  ];

  return (
    <div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-wider">
      {items.map(([tone, label]) => (
        <span
          key={label}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5"
        >
          <span className={cn("h-2 w-2 rounded-full", tone)} />
          {label}
        </span>
      ))}
    </div>
  );
}

function DateSection({
  date,
  jogos,
  groupByTeam,
}: {
  date: string;
  jogos: Jogo[];
  groupByTeam: Map<string, string>;
}) {
  const isToday = date === brasiliaTodayKey();
  const liveCount = jogos.filter((jogo) => matchState(jogo) === "live").length;

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-display text-xs font-black",
            liveCount
              ? "border-live/50 bg-live/15 text-live"
              : isToday
                ? "border-primary/50 bg-primary text-primary-foreground"
                : "border-border bg-card text-primary",
          )}
        >
          {date.slice(-2)}
        </span>
        <div>
          <h4 className="font-display text-base font-black capitalize sm:text-lg">
            {formatDate(date)}
          </h4>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {liveCount ? `${liveCount} ao vivo · ` : ""}
            {jogos.length} jogo{jogos.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {jogos.map((jogo) => (
          <MatchCard key={jogo.id} jogo={jogo} groupByTeam={groupByTeam} />
        ))}
      </div>
    </section>
  );
}

function MatchCard({ jogo, groupByTeam }: { jogo: Jogo; groupByTeam: Map<string, string> }) {
  const [palpitesOpen, setPalpitesOpen] = useState(false);
  const [palpites, setPalpites] = useState<JogoPalpitesResponse | null>(null);
  const [palpitesLoading, setPalpitesLoading] = useState(false);
  const [palpitesError, setPalpitesError] = useState<string | null>(null);
  const state = matchState(jogo);
  const status: "live" | "finished" | "scheduled" =
    state === "live" ? "live" : state === "finished" ? "finished" : "scheduled";
  const group = jogo.fase_id === 1 ? groupByTeam.get(jogo.time1) : null;

  async function togglePalpites() {
    if (palpitesOpen) {
      setPalpitesOpen(false);
      return;
    }
    setPalpitesOpen(true);
    if (palpites || palpitesLoading) return;

    setPalpitesLoading(true);
    setPalpitesError(null);
    try {
      setPalpites(await getPalpitesDoJogo(jogo.id));
    } catch (loadError) {
      setPalpitesError(
        loadError instanceof Error ? loadError.message : "Não foi possível carregar os palpites.",
      );
    } finally {
      setPalpitesLoading(false);
    }
  }

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card shadow-[0_12px_35px_-30px_rgba(0,0,0,0.9)] transition-colors",
        state === "finished" && "border-border bg-card/60 opacity-75",
        state === "today" && "border-primary/50 bg-gradient-to-br from-primary/[0.12] to-card",
        state === "future" && "border-accent/25 hover:border-accent/50",
        state === "live" &&
          "border-live/65 bg-gradient-to-br from-live/[0.16] to-card shadow-[0_0_28px_color-mix(in_oklab,var(--live)_14%,transparent)]",
      )}
    >
      <div
        className={cn(
          "h-1 w-full",
          state === "finished" && "bg-muted-foreground/40",
          state === "today" && "bg-primary",
          state === "future" && "bg-accent/65",
          state === "live" && "bg-live",
        )}
      />
      <div className="p-3.5 sm:p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-wider">
            <span
              className={cn(
                "rounded-md px-2 py-1",
                state === "live"
                  ? "bg-live/15 text-live"
                  : state === "today"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {FASE_LABEL[jogo.fase_id] ?? `Fase ${jogo.fase_id}`}
            </span>
            {group && <span className="text-muted-foreground">Grupo {group}</span>}
            {jogo.rodada && (
              <span className="hidden text-muted-foreground sm:inline">R{jogo.rodada}</span>
            )}
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamSide name={jogo.time1} />
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "num font-display text-[11px] font-black uppercase tracking-wider",
                state === "live" ? "text-live" : "text-muted-foreground",
              )}
            >
              {formatTime(jogo.data)}
            </span>
            {jogo.gols1 != null && jogo.gols2 != null ? (
              <div
                className={cn(
                  "num rounded-lg border px-3 py-1 font-display text-2xl font-black sm:text-3xl",
                  state === "live"
                    ? "border-live/40 bg-live/10 text-live"
                    : "border-border bg-background/45",
                )}
              >
                {jogo.gols1} <span className="text-muted-foreground">x</span> {jogo.gols2}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-background/35 px-3 py-2 font-display text-sm font-black text-muted-foreground">
                VS
              </div>
            )}
          </div>
          <TeamSide name={jogo.time2} align="right" />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/80 pt-3">
          <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {stateLabel(state, jogo.data)}
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={togglePalpites}>
            {palpitesOpen ? "Ocultar palpites" : "Ver palpites"}
          </Button>
        </div>

        {palpitesOpen && (
          <div className="mt-3 rounded-lg border border-border bg-background/45 p-3">
            {palpitesLoading ? (
              <p className="text-xs text-muted-foreground">Carregando palpites...</p>
            ) : palpitesError ? (
              <p className="text-xs text-destructive">{palpitesError}</p>
            ) : palpites?.palpites.length ? (
              <ul className="space-y-2">
                {palpites.palpites.map((palpite) => (
                  <li
                    key={palpite.user_id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
                        {getInitials(palpite.nome_completo)}
                      </span>
                      <span className="truncate font-semibold">{palpite.nome_completo}</span>
                    </span>
                    <span className="num font-display text-sm font-black">
                      {palpite.palpite.gols1} x {palpite.palpite.gols2}
                    </span>
                    <span className="num text-right text-muted-foreground">
                      {palpite.pontos == null ? "-" : `+${palpite.pontos}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum palpite registrado para este jogo.
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function TeamSide({ name, align = "left" }: { name: string; align?: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", align === "right" && "items-end text-right")}>
      <Flag code={teamCodeFromName(name)} name={name} size="lg" static />
      <span className="line-clamp-2 text-xs font-black leading-tight sm:text-sm">{name}</span>
    </div>
  );
}

function CalendarSkeleton({ compact }: { compact?: boolean }) {
  return (
    <>
      {!compact && (
        <header className="mb-4 h-56 animate-pulse rounded-2xl border border-border bg-card/60 sm:h-52" />
      )}
      <div className="mb-6 h-14 animate-pulse rounded-xl border border-border bg-card/60" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-52 animate-pulse rounded-xl border border-border bg-card/60"
          />
        ))}
      </div>
    </>
  );
}

function matchState(jogo: Jogo): MatchState {
  if (jogo.encerrado) return "finished";
  if (new Date(jogo.data).getTime() <= nowAsStoredBrasiliaMs()) return "live";
  if (brasiliaDateKey(jogo.data) === brasiliaTodayKey()) return "today";
  return "future";
}

function stateLabel(state: MatchState, iso: string) {
  if (state === "finished") return "Partida encerrada";
  if (state === "live") return "Partida em andamento";
  if (state === "today") return `Acontece hoje às ${formatTime(iso)}`;
  return `Próximo jogo · ${formatShortDate(iso)}`;
}

function filterTitle(status: StatusFilter, group: string) {
  if (group !== "all") return `Jogos do Grupo ${group}`;
  if (status === "today") return "Jogos de hoje";
  if (status === "live") return "Acontecendo agora";
  if (status === "finished") return "Jogos encerrados";
  return "Calendário da Copa";
}

function brasiliaDateKey(iso: string) {
  return iso.slice(0, 10);
}

function brasiliaTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function formatDate(yyyymmdd: string) {
  const [year, month, day] = yyyymmdd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
}

function nowAsStoredBrasiliaMs() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return Date.parse(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`,
  );
}
