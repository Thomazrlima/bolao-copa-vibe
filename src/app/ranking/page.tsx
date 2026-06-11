"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, Medal, Trophy } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";

type RankingUsuario = {
  id: string;
  nome_completo: string;
  pontos: number;
  chineladas: number;
};

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRanking() {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/ranking", { cache: "no-store" });
      const body = await response.json();

      if (!active) return;

      if (!response.ok) {
        setError(body.error ?? "Não foi possível carregar o ranking.");
        setLoading(false);
        return;
      }

      setRanking(body.ranking ?? []);
      setLoading(false);
    }

    loadRanking();

    return () => {
      active = false;
    };
  }, []);

  const podium = useMemo(() => ranking.slice(0, 3), [ranking]);
  const rest = useMemo(() => ranking.slice(3), [ranking]);

  return (
    <AppShell>
      <PageHeader
        title="Ranking Geral"
        subtitle="Participantes oficiais do bolão · pontos e chineladas começam zerados"
      />

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando ranking...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center text-sm text-destructive">
          {error}
        </div>
      ) : (
        <>
          <Podium ranking={podium} />

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-[48px_minmax(0,1fr)_80px_92px] items-center gap-2 border-b border-border bg-background/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:grid-cols-[64px_minmax(0,1fr)_100px_120px] sm:px-5 sm:py-3 sm:text-xs">
              <span>#</span>
              <span>Participante</span>
              <span className="text-right">Pontos</span>
              <span className="text-right">Chineladas</span>
            </div>
            <ul className="divide-y divide-border">
              {rest.map((row, i) => (
                <RankingRow key={row.id} row={row} pos={i + 4} />
              ))}
            </ul>
          </div>
        </>
      )}
    </AppShell>
  );
}

function RankingRow({ row, pos }: { row: RankingUsuario; pos: number }) {
  const Icon = pos === 1 ? Trophy : pos === 2 ? Medal : pos === 3 ? Award : null;

  return (
    <li className="grid grid-cols-[48px_minmax(0,1fr)_80px_92px] items-center gap-2 px-3 py-3 sm:grid-cols-[64px_minmax(0,1fr)_100px_120px] sm:px-5 sm:py-4">
      <span className="flex items-center gap-1">
        <span
          className={cn(
            "font-display text-lg font-black num",
            pos <= 3 ? "text-primary" : "text-muted-foreground",
          )}
        >
          {pos}
        </span>
        {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <AvatarName name={row.nome_completo} />
        <span className="truncate font-semibold">{row.nome_completo}</span>
      </span>
      <span className="num text-right font-bold text-primary">{row.pontos}</span>
      <span className="num text-right text-muted-foreground">{row.chineladas}</span>
    </li>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Podium({ ranking }: { ranking: RankingUsuario[] }) {
  if (ranking.length < 3) return null;

  const [first, second, third] = ranking;
  const slots: Array<{ row: RankingUsuario; pos: 1 | 2 | 3 }> = [
    { row: second, pos: 2 },
    { row: first, pos: 1 },
    { row: third, pos: 3 },
  ];
  const heights: Record<1 | 2 | 3, string> = {
    1: "h-40 sm:h-52",
    2: "h-28 sm:h-36",
    3: "h-20 sm:h-28",
  };
  const labels: Record<1 | 2 | 3, string> = { 1: "1º", 2: "2º", 3: "3º" };

  return (
    <div className="mb-8 rounded-2xl border border-border bg-card/60 p-4 sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        <Trophy className="h-3.5 w-3.5 text-primary" /> Pódio
      </div>
      <div className="grid grid-cols-3 items-end gap-3 sm:gap-6">
        {slots.map(({ row, pos }) => (
          <div key={row.id} className="group flex flex-col items-center text-center">
            <div className="mb-2 flex flex-col items-center">
              <AvatarName name={row.nome_completo} large={pos === 1} />
              <span className="mt-2 max-w-[120px] truncate text-xs font-semibold sm:text-sm">
                {row.nome_completo}
              </span>
            </div>
            <div
              className={cn(
                "flex w-full flex-col items-center justify-between gap-1 rounded-t-xl border border-b-0 px-2 py-3 font-display font-black",
                heights[pos],
                pos === 1
                  ? "border-primary/60 bg-primary/20 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              <span className={cn(pos === 1 ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl")}>
                {labels[pos]}
              </span>
              <span
                className={cn(
                  "num leading-none",
                  pos === 1
                    ? "text-4xl text-primary sm:text-6xl"
                    : "text-2xl text-foreground sm:text-4xl",
                )}
              >
                {row.pontos}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 sm:text-[10px]">
                pts · {row.chineladas} chineladas
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AvatarName({ name, large }: { name: string; large?: boolean }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary/20 font-display font-black text-primary ring-2 ring-primary/50",
        large ? "h-16 w-16 text-xl sm:h-20 sm:w-20 sm:text-2xl" : "h-9 w-9 text-xs",
      )}
    >
      {initials}
    </span>
  );
}
