import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useBolaoStore } from "@/lib/store";
import { rankParticipants, type ParticipantStats } from "@/lib/ranking";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { GROUP_FIXTURES, type Score } from "@/data/fixtures";
import { TEAM_BY_CODE } from "@/data/teams";
import { compareGuess } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { Trophy, Medal, Award } from "lucide-react";
import { Flag } from "@/components/common/Flag";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking · Bolão dos v(devers)" },
      { name: "description", content: "Ranking geral do bolão da Copa de 48 seleções: acertos cheios, parciais e pontuação total." },
      { property: "og:title", content: "Ranking · Bolão dos v(devers)" },
      { property: "og:description", content: "Pontuação acumulada dos participantes do bolão da Copa de 48 seleções." },
    ],
  }),
  component: RankingPage,
});

function RankingPage() {
  const results = useBolaoStore((s) => s.results);
  const ranking = useMemo(() => rankParticipants(results), [results]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = ranking.find((r) => r.participant.id === openId) ?? null;

  return (
    <AppShell>
      <PageHeader
        title="Ranking Geral"
        subtitle="Pontos pelos jogos da fase de grupos · atualiza em tempo real"
      />

      <Podium ranking={ranking} onSelect={setOpenId} />


      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[48px_minmax(0,1fr)_60px_60px_80px] items-center gap-2 border-b border-border bg-background/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:grid-cols-[64px_minmax(0,1fr)_80px_80px_100px] sm:px-5 sm:py-3 sm:text-xs">
          <span>#</span>
          <span>Participante</span>
          <span className="text-right">Cheios</span>
          <span className="text-right">Parciais</span>
          <span className="text-right">Total</span>
        </div>
        <ul className="divide-y divide-border">
          {ranking.map((r, i) => (
            <RankingRow
              key={r.participant.id}
              row={r}
              pos={i + 1}
              onClick={() => setOpenId(r.participant.id)}
            />
          ))}
        </ul>
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {open && <ParticipantDetail row={open} results={results} />}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function RankingRow({ row, pos, onClick }: { row: ParticipantStats; pos: number; onClick: () => void }) {
  const Icon = pos === 1 ? Trophy : pos === 2 ? Medal : pos === 3 ? Award : null;
  return (
    <li>
      <button
        onClick={onClick}
        className="grid w-full grid-cols-[48px_minmax(0,1fr)_60px_60px_80px] items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-background/60 sm:grid-cols-[64px_minmax(0,1fr)_80px_80px_100px] sm:px-5 sm:py-4"
      >
        <span className="flex items-center gap-1">
          <span className={cn("font-display text-lg font-black num", pos <= 3 ? "text-primary" : "text-muted-foreground")}>{pos}</span>
          {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
        </span>
        <span className="flex min-w-0 items-center gap-3">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold", row.participant.color)}>
            {row.participant.initials}
          </span>
          <span className="truncate font-semibold">{row.participant.name}</span>
        </span>
        <span className="num text-right font-bold text-primary">{row.exact}</span>
        <span className="num text-right text-muted-foreground">{row.partial}</span>
        <span className="num text-right font-display text-xl font-black">{row.total}</span>
      </button>
    </li>
  );
}

function ParticipantDetail({ row, results }: { row: ParticipantStats; results: Record<string, Score | null> }) {
  return (
    <>
      <SheetHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className={cn("grid h-14 w-14 place-items-center rounded-2xl text-lg font-black", row.participant.color)}>
            {row.participant.initials}
          </div>
          <div className="min-w-0">
            <SheetTitle className="font-display text-xl">{row.participant.name}</SheetTitle>
            <SheetDescription className="num">
              <span className="text-primary font-bold">{row.total} pts</span> · {row.exact} cheios · {row.partial} parciais · {row.miss} erros
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="space-y-2 px-4 pb-6">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Palpites por jogo</h3>
        {GROUP_FIXTURES.map((f) => {
          const real = results[f.id];
          const guess = row.participant.guesses[f.id];
          const home = TEAM_BY_CODE[f.homeCode!];
          const away = TEAM_BY_CODE[f.awayCode!];
          const outcome = real && guess ? compareGuess(guess, real) : null;
          const badge =
            outcome === "exact"
              ? { label: "CHEIO", cls: "bg-primary text-primary-foreground" }
              : outcome === "partial"
                ? { label: "PARCIAL", cls: "border border-accent text-accent" }
                : outcome === "miss"
                  ? { label: "ERROU", cls: "bg-muted text-muted-foreground" }
                  : { label: "—", cls: "border border-border text-muted-foreground" };
          return (
            <div key={f.id} className="rounded-lg border border-border bg-card/60 p-3">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>Grupo {f.group}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", badge.cls)}>{badge.label}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 items-center gap-2 text-sm">
                <span className="flex items-center gap-1.5 truncate"><Flag code={home?.code} name={home?.name} size="md" /> <span className="truncate">{home?.name}</span></span>
                <span className="text-center text-xs text-muted-foreground">
                  <div className="num">palpite <b className="text-foreground">{guess?.home}-{guess?.away}</b></div>
                  <div className="num">real <b className="text-foreground">{real ? `${real.home}-${real.away}` : "—"}</b></div>
                </span>
                <span className="flex items-center justify-end gap-1.5 truncate"><span className="truncate text-right">{away?.name}</span> <Flag code={away?.code} name={away?.name} size="md" /></span>
              </div>
            </div>
          );
        })}
      </div>
    </>
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
