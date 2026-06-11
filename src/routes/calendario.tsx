import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ALL_FIXTURES, GROUP_FIXTURES, stageLabel, type Fixture } from "@/data/fixtures";
import { useBolaoStore } from "@/lib/store";
import { TEAM_BY_CODE, GROUPS } from "@/data/teams";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ScoreEditor } from "@/components/common/ScoreEditor";
import { cn } from "@/lib/utils";
import { computeBracket } from "@/lib/bracket";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário · Bolão dos v(devers)" },
      { name: "description", content: "Todos os jogos da Copa de 48 seleções com horários, estádios, placares e edição rápida de resultados." },
      { property: "og:title", content: "Calendário · Bolão dos v(devers)" },
      { property: "og:description", content: "Cronograma completo da Copa com filtros por fase, grupo e jogos de hoje." },
    ],
  }),
  component: CalendarioPage,
});

type FaseFilter = "all" | "group" | "ko" | "today";

function CalendarioPage() {
  const results = useBolaoStore((s) => s.results);
  const [fase, setFase] = useState<FaseFilter>("all");
  const [group, setGroup] = useState<string>("all");

  // resolve KO teams dynamically
  const bracket = useMemo(() => computeBracket(results), [results]);
  const koResolved = useMemo(() => {
    const map = new Map<string, { home?: string; away?: string }>();
    [...bracket.r32, ...bracket.r16, ...bracket.qf, ...bracket.sf, bracket.third, bracket.final].forEach((s) => {
      map.set(s.id, { home: s.home?.team.code, away: s.away?.team.code });
    });
    return map;
  }, [bracket]);

  const fixtures = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return ALL_FIXTURES.filter((f) => {
      if (fase === "group" && f.stage !== "group") return false;
      if (fase === "ko" && f.stage === "group") return false;
      if (fase === "today" && f.kickoff.slice(0, 10) !== todayStr) return false;
      if (group !== "all" && f.group !== group) return false;
      return true;
    });
  }, [fase, group]);

  const grouped = useMemo(() => {
    const m = new Map<string, Fixture[]>();
    fixtures.forEach((f) => {
      const k = f.kickoff.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    });
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [fixtures]);

  return (
    <AppShell>
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Calendário</h2>
        <p className="text-sm text-muted-foreground">Edite qualquer placar para ver tudo recalcular em tempo real</p>
      </div>

      <div className="sticky top-[112px] z-30 -mx-4 mb-6 flex flex-wrap items-center gap-2 border-y border-border bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <FilterChip active={fase === "all"} onClick={() => setFase("all")}>Todos</FilterChip>
        <FilterChip active={fase === "group"} onClick={() => setFase("group")}>Fase de Grupos</FilterChip>
        <FilterChip active={fase === "ko"} onClick={() => setFase("ko")}>Mata-Mata</FilterChip>
        <FilterChip active={fase === "today"} onClick={() => setFase("today")}>Hoje</FilterChip>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Grupo:</label>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1 text-sm"
          >
            <option value="all">Todos</option>
            {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-8">
        {grouped.map(([date, items]) => (
          <section key={date}>
            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {formatDate(date)} · <span className="text-foreground">{items.length} jogo{items.length > 1 ? "s" : ""}</span>
            </h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {items.map((f) => (
                <MatchCard
                  key={f.id}
                  fixture={f}
                  resolvedHome={f.stage === "group" ? f.homeCode : koResolved.get(f.id)?.home}
                  resolvedAway={f.stage === "group" ? f.awayCode : koResolved.get(f.id)?.away}
                />
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
    </AppShell>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
        active ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function MatchCard({ fixture, resolvedHome, resolvedAway }: { fixture: Fixture; resolvedHome?: string; resolvedAway?: string }) {
  const result = useBolaoStore((s) => s.results[fixture.id]);
  const home = resolvedHome ? TEAM_BY_CODE[resolvedHome] : undefined;
  const away = resolvedAway ? TEAM_BY_CODE[resolvedAway] : undefined;
  const status: "live" | "finished" | "scheduled" = fixture.live ? "live" : result ? "finished" : "scheduled";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 font-bold">
            {fixture.stage === "group" ? `Grupo ${fixture.group}` : stageLabel(fixture.stage)}
          </span>
          <span className="num">{formatTime(fixture.kickoff)}</span>
        </span>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamSide name={home?.name ?? "—"} code={home?.code} align="left" />
        <div className="flex flex-col items-center gap-1">
          {result ? (
            <div className="num font-display text-3xl font-black">
              {result.home} <span className="text-muted-foreground">–</span> {result.away}
            </div>
          ) : (
            <div className="num font-display text-xl font-black text-muted-foreground">– vs –</div>
          )}
        </div>
        <TeamSide name={away?.name ?? "—"} code={away?.code} align="right" />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="truncate text-[11px] text-muted-foreground">📍 {fixture.stadium}</span>
        <ScoreEditor fixtureId={fixture.id} compact />
      </div>
    </div>
  );
}

function TeamSide({ name, flag, align }: { name: string; flag: string; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <span className="text-3xl">{flag}</span>
      <span className="truncate text-sm font-bold">{name}</span>
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(yyyymmdd: string) {
  const d = new Date(yyyymmdd + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}
