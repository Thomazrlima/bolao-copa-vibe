"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
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

type FaseFilter = "all" | "group" | "today";

const FASE_LABEL: Record<number, string> = {
  1: "Grupos",
  2: "16-avos",
  3: "Oitavas",
  4: "Quartas",
  5: "Semifinal",
  6: "Disputa de 3º",
  7: "Final",
};

export default function CalendarioPage() {
  const mounted = useMounted();
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [fase, setFase] = useState<FaseFilter>("all");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJogos = useCallback(async () => {
    const response = await fetch("/api/jogos", { cache: "no-store" });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error ?? "Não foi possível carregar os jogos.");
      return;
    }

    setJogos(body.jogos ?? []);
  }, []);

  const syncJogos = useCallback(async () => {
    setSyncing(true);
    const response = await fetch("/api/jogos/sync", { method: "POST" });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(body.error ?? "Não foi possível sincronizar os placares.");
      setSyncing(false);
      return;
    }

    await loadJogos();
    setSyncing(false);
  }, [loadJogos]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      await loadJogos();
      if (active) setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [loadJogos]);

  const hasStartedOpenGame = useMemo(() => {
    if (!mounted) return false;
    const nowMs = nowAsStoredBrasiliaMs();
    return jogos.some((jogo) => !jogo.encerrado && new Date(jogo.data).getTime() <= nowMs);
  }, [jogos, mounted]);

  useEffect(() => {
    if (!hasStartedOpenGame) return;

    syncJogos();
    const interval = window.setInterval(syncJogos, 30_000);

    return () => window.clearInterval(interval);
  }, [hasStartedOpenGame, syncJogos]);

  const filtered = useMemo(() => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    return jogos.filter((jogo) => {
      if (fase === "group" && jogo.fase_id !== 1) return false;
      if (fase === "today" && brasiliaDateKey(jogo.data) !== today) return false;
      return true;
    });
  }, [fase, jogos]);

  const grouped = useMemo(() => {
    const roundMap = new Map<string, Map<string, Jogo[]>>();

    filtered.forEach((jogo) => {
      const roundKey = jogo.rodada ? `Rodada ${jogo.rodada}` : "Sem rodada";
      const dateKey = brasiliaDateKey(jogo.data);

      if (!roundMap.has(roundKey)) roundMap.set(roundKey, new Map());

      const dateMap = roundMap.get(roundKey)!;
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
      dateMap.get(dateKey)!.push(jogo);
    });

    return [...roundMap.entries()]
      .sort(([a], [b]) => sortRoundLabel(a, b))
      .map(([round, dates]) => ({
        round,
        total: [...dates.values()].reduce((sum, items) => sum + items.length, 0),
        dates: [...dates.entries()].sort(([a], [b]) => a.localeCompare(b)),
      }));
  }, [filtered]);

  if (!mounted) {
    return <CalendarSkeleton />;
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Calendário</h2>
        <p className="text-sm text-muted-foreground">
          Jogos importados do CSV · horários exibidos no fuso de Brasília
        </p>
      </div>

      <div className="sticky top-[112px] z-30 -mx-4 mb-6 flex flex-wrap items-center gap-2 border-y border-border bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <FilterChip active={fase === "all"} onClick={() => setFase("all")}>
          Todos
        </FilterChip>
        <FilterChip active={fase === "group"} onClick={() => setFase("group")}>
          Grupos
        </FilterChip>
        <FilterChip active={fase === "today"} onClick={() => setFase("today")}>
          Hoje
        </FilterChip>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={syncJogos}
          disabled={syncing}
          className="ml-auto gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          Sincronizar
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <CalendarSkeleton />
      ) : (
        <div className="space-y-10">
          {grouped.map(({ round, total, dates }) => (
            <section key={round}>
              <div className="mb-4 flex items-end justify-between gap-3 border-b border-border pb-2">
                <h3 className="font-display text-xl font-black tracking-tight">{round}</h3>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {total} jogo{total > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-6">
                {dates.map(([date, items]) => (
                  <section key={`${round}-${date}`}>
                    <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      {formatDate(date)} ·{" "}
                      <span className="text-foreground">
                        {items.length} jogo{items.length > 1 ? "s" : ""}
                      </span>
                    </h4>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {items.map((jogo) => (
                        <MatchCard key={jogo.id} jogo={jogo} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))}
          {grouped.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              Nenhum jogo encontrado com os filtros atuais.
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CalendarSkeleton() {
  return (
    <>
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Calendário</h2>
        <p className="text-sm text-muted-foreground">Carregando jogos...</p>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-40 rounded-2xl border border-border bg-card/60" />
        ))}
      </div>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-9 shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function MatchCard({ jogo }: { jogo: Jogo }) {
  const started = new Date(jogo.data).getTime() <= nowAsStoredBrasiliaMs();
  const status: "live" | "finished" | "scheduled" = jogo.encerrado
    ? "finished"
    : started
      ? "live"
      : "scheduled";

  return (
    <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 sm:p-4">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 font-bold">
            {FASE_LABEL[jogo.fase_id] ?? `Fase ${jogo.fase_id}`}
          </span>
          <span className="num">{formatTime(jogo.data)}</span>
        </span>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamSide name={jogo.time1} align="left" />
        <div className="flex flex-col items-center gap-1">
          {jogo.gols1 != null && jogo.gols2 != null ? (
            <div className="num font-display text-3xl font-black">
              {jogo.gols1} <span className="text-muted-foreground">–</span> {jogo.gols2}
            </div>
          ) : (
            <div className="num font-display text-xl font-black text-muted-foreground">– vs –</div>
          )}
          {jogo.sportsdb_status && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {jogo.sportsdb_status}
            </span>
          )}
        </div>
        <TeamSide name={jogo.time2} align="right" />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">
          TheSportsDB #{jogo.sportsdb_event_id}
        </span>
        {jogo.sincronizado_em && (
          <span className="text-[11px] text-muted-foreground">
            sync {formatTime(jogo.sincronizado_em)}
          </span>
        )}
      </div>
    </div>
  );
}

function TeamSide({ name, align }: { name: string; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0", align === "right" && "justify-end text-right")}>
      <span className="truncate text-sm font-bold">{name}</span>
    </div>
  );
}

function brasiliaDateKey(iso: string) {
  return iso.slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatDate(yyyymmdd: string) {
  const [year, month, day] = yyyymmdd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
}

function sortRoundLabel(a: string, b: string) {
  const aNumber = Number.parseInt(a.replace(/\D/g, ""), 10);
  const bNumber = Number.parseInt(b.replace(/\D/g, ""), 10);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
  if (Number.isFinite(aNumber)) return -1;
  if (Number.isFinite(bNumber)) return 1;
  return a.localeCompare(b);
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
