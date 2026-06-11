"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useBolaoStore } from "@/lib/store";
import { allGroupStandings, bestThirds, type Standing } from "@/lib/standings";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/common/Flag";
import { useMounted } from "@/hooks/use-mounted";

export default function GruposPage() {
  const mounted = useMounted();
  const results = useBolaoStore((s) => s.results);
  const groups = useMemo(() => allGroupStandings(results), [results]);
  const thirds = useMemo(() => bestThirds(results), [results]);

  if (!mounted) {
    return (
      <AppShell>
        <PageSkeleton title="Grupos & Classificação" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
          Grupos & Classificação
        </h2>
        <p className="text-sm text-muted-foreground">
          12 grupos · 4 seleções · 2 primeiros + 8 melhores 3ºs avançam
        </p>
      </div>

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
              8 melhores avançam ao mata-mata · atualização em tempo real
            </p>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">P · SG · GP</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[36px_minmax(0,1fr)_40px_40px_40px_90px] gap-2 border-b border-border bg-background/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:grid-cols-[48px_minmax(0,1fr)_60px_60px_60px_120px] sm:px-5">
            <span>#</span>
            <span>Seleção</span>
            <span className="text-right">P</span>
            <span className="text-right">SG</span>
            <span className="text-right">GP</span>
            <span className="text-right">Status</span>
          </div>
          <ul className="divide-y divide-border">
            {thirds.map((s, i) => {
              const classified = i < 8;
              return (
                <li
                  key={s.team.code}
                  className={cn(
                    "grid grid-cols-[36px_minmax(0,1fr)_40px_40px_40px_90px] items-center gap-2 px-3 py-2.5 text-sm sm:grid-cols-[48px_minmax(0,1fr)_60px_60px_60px_120px] sm:px-5",
                    classified ? "bg-primary/10" : "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "font-display font-black num",
                      classified ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <Flag code={s.team.code} name={s.team.name} size="lg" />
                    <span className="truncate font-semibold">{s.team.name}</span>
                    <span className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground sm:inline">
                      G{s.group}
                    </span>
                  </span>
                  <span className="num text-right font-bold">{s.points}</span>
                  <span className="num text-right">{s.gd > 0 ? `+${s.gd}` : s.gd}</span>
                  <span className="num text-right">{s.gf}</span>
                  <span className="text-right">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        classified
                          ? "bg-primary text-primary-foreground"
                          : "bg-destructive/20 text-destructive",
                      )}
                    >
                      {classified ? "Classificado" : "Fora"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </AppShell>
  );
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
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-background/40 px-4 py-2.5">
        <h4 className="font-display text-lg font-black tracking-tight">
          Grupo <span className="text-primary">{group}</span>
        </h4>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          P · SG · GP
        </span>
      </div>
      <ul className="divide-y divide-border">
        {standings.map((s, i) => {
          const top2 = i < 2;
          const third = i === 2;
          return (
            <li
              key={s.team.code}
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
                {i + 1}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <Flag code={s.team.code} name={s.team.name} size="md" />
                <span className="truncate text-[13px] font-medium">{s.team.name}</span>
              </span>
              <span className="num text-right font-bold">{s.points}</span>
              <span className="num text-right text-muted-foreground">
                {s.gd > 0 ? `+${s.gd}` : s.gd}
              </span>
              <span className="num text-right text-muted-foreground">{s.gf}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
