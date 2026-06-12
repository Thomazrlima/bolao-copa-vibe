"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

type GrupoRow = {
  grupo: string;
  time: string;
  pontuacao: number;
  saldo_gols: number;
  gols_pro: number;
  gols_contra: number;
  updated_at?: string;
};

type JogoGrupo = {
  id: string;
  fase_id: number;
  time1: string;
  time2: string;
  data: string;
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
};

type Standing = GrupoRow & {
  jogos: number;
};

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

export default function GruposPage() {
  const mounted = useMounted();
  const [grupos, setGrupos] = useState<GrupoRow[]>([]);
  const [jogos, setJogos] = useState<JogoGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const loadGrupos = useCallback(async () => {
    const response = await fetch("/api/grupos", { cache: "no-store" });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error ?? "Não foi possível carregar os grupos.");
      return;
    }

    setGrupos(body.grupos ?? []);
    setJogos(body.jogos ?? []);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      await loadGrupos();
      if (active) setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [loadGrupos]);

  const hasStartedOpenGame = useMemo(() => {
    if (!mounted) return false;
    void nowTick;
    const nowMs = nowAsStoredBrasiliaMs();
    return jogos.some((jogo) => !jogo.encerrado && new Date(jogo.data).getTime() <= nowMs);
  }, [jogos, mounted, nowTick]);

  useEffect(() => {
    if (!mounted) return;

    const interval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 120_000);

    return () => window.clearInterval(interval);
  }, [mounted]);

  useEffect(() => {
    if (!hasStartedOpenGame) return;

    const interval = window.setInterval(loadGrupos, 120_000);

    return () => window.clearInterval(interval);
  }, [hasStartedOpenGame, loadGrupos]);

  const groups = useMemo(() => {
    const liveRows = computeLiveStandings(grupos, jogos);
    const grouped = new Map<string, Standing[]>();

    liveRows.forEach((row) => {
      if (!grouped.has(row.grupo)) grouped.set(row.grupo, []);
      grouped.get(row.grupo)!.push(row);
    });

    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, standings]) => ({
        group,
        standings: standings.sort((a, b) => sortStandings(a, b, jogos)),
      }));
  }, [grupos, jogos]);

  const thirds = useMemo(
    () =>
      groups
        .map(({ standings }) => standings[2])
        .filter(Boolean)
        .sort((a, b) => sortStandings(a, b, jogos)),
    [groups, jogos],
  );

  if (!mounted || loading) {
    return <PageSkeleton title="Grupos & Classificação" />;
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
          Grupos & Classificação
        </h2>
        <p className="text-sm text-muted-foreground">
          Classificação real · jogos ao vivo recalculados no navegador a cada 2 minutos
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groups.map(({ group, standings }) => (
          <GroupCard key={group} group={group} standings={standings} />
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h3 className="font-display text-xl font-black tracking-tight">
              Ranking dos 3º Colocados
            </h3>
            <p className="text-sm text-muted-foreground">
              8 melhores avançam ao mata-mata · desempate por pontos, saldo e gols pró
            </p>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">P · SG · GP</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid grid-cols-[28px_minmax(0,1fr)_32px_36px_68px] gap-1.5 border-b border-border bg-background/40 px-2 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:grid-cols-[48px_minmax(0,1fr)_60px_60px_60px_120px] sm:gap-2 sm:px-5 sm:text-[10px]">
            <span>#</span>
            <span>Seleção</span>
            <span className="text-right">P</span>
            <span className="text-right">SG</span>
            <span className="hidden text-right sm:block">GP</span>
            <span className="text-right">Status</span>
          </div>
          <ul className="divide-y divide-border">
            {thirds.map((standing, index) => {
              const classified = index < 8;
              return (
                <li
                  key={`${standing.grupo}-${standing.time}`}
                  className={cn(
                    "grid grid-cols-[28px_minmax(0,1fr)_32px_36px_68px] items-center gap-1.5 px-2 py-2.5 text-xs sm:grid-cols-[48px_minmax(0,1fr)_60px_60px_60px_120px] sm:gap-2 sm:px-5 sm:text-sm",
                    classified ? "bg-primary/10" : "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "font-display font-black num",
                      classified ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold">{standing.time}</span>
                    <span className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground sm:inline">
                      G{standing.grupo}
                    </span>
                  </span>
                  <span className="num text-right font-bold">{standing.pontuacao}</span>
                  <span className="num text-right">{formatSigned(standing.saldo_gols)}</span>
                  <span className="num text-right">{standing.gols_pro}</span>
                  <span className="text-right">
                    <span
                      className={cn(
                        "inline-block max-w-full truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase sm:px-2 sm:text-[10px] sm:tracking-wider",
                        classified
                          ? "bg-primary text-primary-foreground"
                          : "bg-destructive/20 text-destructive",
                      )}
                    >
                      <span className="sm:hidden">{classified ? "Avança" : "Fora"}</span>
                      <span className="hidden sm:inline">
                        {classified ? "Classificado" : "Fora"}
                      </span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}

function computeLiveStandings(grupos: GrupoRow[], jogos: JogoGrupo[]): Standing[] {
  const map = new Map<string, Standing>();

  grupos.forEach((row) => {
    map.set(row.time, {
      ...row,
      pontuacao: 0,
      saldo_gols: 0,
      gols_pro: 0,
      gols_contra: 0,
      jogos: 0,
    });
  });

  jogos.forEach((jogo) => {
    if (jogo.gols1 == null || jogo.gols2 == null) return;

    const home = map.get(jogo.time1);
    const away = map.get(jogo.time2);
    if (!home || !away || home.grupo !== away.grupo) return;

    home.jogos += 1;
    away.jogos += 1;
    home.gols_pro += jogo.gols1;
    home.gols_contra += jogo.gols2;
    away.gols_pro += jogo.gols2;
    away.gols_contra += jogo.gols1;

    if (jogo.gols1 > jogo.gols2) {
      home.pontuacao += 3;
    } else if (jogo.gols1 < jogo.gols2) {
      away.pontuacao += 3;
    } else {
      home.pontuacao += 1;
      away.pontuacao += 1;
    }
  });

  map.forEach((row) => {
    row.saldo_gols = row.gols_pro - row.gols_contra;
  });

  return [...map.values()];
}

function sortStandings(a: Standing, b: Standing, jogos: JogoGrupo[]) {
  if (b.pontuacao !== a.pontuacao) return b.pontuacao - a.pontuacao;

  const direct = compareDirect(a, b, jogos);
  if (direct !== 0) return direct;

  if (b.saldo_gols !== a.saldo_gols) return b.saldo_gols - a.saldo_gols;
  if (b.gols_pro !== a.gols_pro) return b.gols_pro - a.gols_pro;
  return a.time.localeCompare(b.time);
}

function compareDirect(a: Standing, b: Standing, jogos: JogoGrupo[]) {
  const directGame = jogos.find(
    (jogo) =>
      jogo.gols1 != null &&
      jogo.gols2 != null &&
      ((jogo.time1 === a.time && jogo.time2 === b.time) ||
        (jogo.time1 === b.time && jogo.time2 === a.time)),
  );

  if (!directGame || directGame.gols1 == null || directGame.gols2 == null) return 0;

  const aGoals = directGame.time1 === a.time ? directGame.gols1 : directGame.gols2;
  const bGoals = directGame.time1 === b.time ? directGame.gols1 : directGame.gols2;

  if (aGoals > bGoals) return -1;
  if (aGoals < bGoals) return 1;
  return 0;
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : value;
}

function PageSkeleton({ title }: { title: string }) {
  return (
    <>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
        <p className="text-sm text-muted-foreground">Carregando dados...</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-48 rounded-2xl border border-border bg-card/60" />
        ))}
      </div>
    </>
  );
}

function GroupCard({ group, standings }: { group: string; standings: Standing[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-background/40 px-4 py-2.5">
        <h4 className="font-display text-lg font-black tracking-tight">
          Grupo <span className="text-primary">{group}</span>
        </h4>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          P · SG · GP
        </span>
      </div>
      <ul className="divide-y divide-border">
        {standings.map((standing, index) => {
          const top2 = index < 2;
          const third = index === 2;
          return (
            <li
              key={standing.time}
              className={cn(
                "grid grid-cols-[20px_minmax(0,1fr)_28px_36px_28px] items-center gap-2 px-3 py-2 text-sm",
                top2 && "bg-primary/10",
                third && "bg-accent/5",
              )}
            >
              <span
                className={cn(
                  "font-display font-black num",
                  top2 ? "text-primary" : "text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0 truncate text-[13px] font-medium">{standing.time}</span>
              <span className="num text-right font-bold">{standing.pontuacao}</span>
              <span className="num text-right text-muted-foreground">
                {formatSigned(standing.saldo_gols)}
              </span>
              <span className="num text-right text-muted-foreground">{standing.gols_pro}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
