import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { useBolaoStore } from "@/lib/store";
import { computeBracket, type BracketSlot } from "@/lib/bracket";
import { ScoreEditor } from "@/components/common/ScoreEditor";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mata-mata")({
  head: () => ({
    meta: [
      { title: "Mata-Mata · Bolão dos v(devers)" },
      { name: "description", content: "Simulador do mata-mata da Copa de 48 seleções: edite placares e veja o bracket se atualizar em tempo real." },
      { property: "og:title", content: "Mata-Mata · Bolão dos v(devers)" },
      { property: "og:description", content: "Se a Copa terminasse agora — bracket dinâmico do Round of 32 à Final." },
    ],
  }),
  component: MataMataPage,
});

function MataMataPage() {
  const results = useBolaoStore((s) => s.results);
  const bracket = useMemo(() => computeBracket(results), [results]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Mata-Mata</h2>
        <p className="text-sm text-muted-foreground">Se a Copa terminasse agora · edite qualquer placar para simular</p>
      </div>

      <div className="mb-8 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-5 ring-yellow">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Trophy className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Campeão projetado</p>
            <AnimatePresence mode="wait">
              <motion.h3
                key={bracket.champion?.code ?? "none"}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                className="font-display text-2xl font-black tracking-tight sm:text-3xl"
              >
                {bracket.champion ? (
                  <span className="flex items-center gap-3">
                    <span className="text-3xl sm:text-4xl">{bracket.champion.flag}</span>
                    {bracket.champion.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">— preencha os resultados —</span>
                )}
              </motion.h3>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-fit gap-6">
          <Round title="16-avos" matches={bracket.r32} />
          <Round title="Oitavas" matches={bracket.r16} />
          <Round title="Quartas" matches={bracket.qf} />
          <Round title="Semis" matches={bracket.sf} />
          <Round title="Final" matches={[bracket.final]} highlight />
        </div>
      </div>

      <section className="mt-8">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Disputa de 3º Lugar</h3>
        <div className="max-w-md">
          <MatchPill match={bracket.third} />
        </div>
      </section>
    </AppShell>
  );
}

function Round({ title, matches, highlight }: { title: string; matches: BracketSlot[]; highlight?: boolean }) {
  return (
    <div className="flex w-[260px] shrink-0 flex-col gap-3">
      <h3 className={cn(
        "sticky top-0 z-10 rounded-md px-2 py-1 text-center font-display text-xs font-bold uppercase tracking-[0.2em]",
        highlight ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
      )}>
        {title}
      </h3>
      <div className="flex flex-1 flex-col justify-around gap-3">
        {matches.map((m) => <MatchPill key={m.id} match={m} />)}
      </div>
    </div>
  );
}

function MatchPill({ match }: { match: BracketSlot }) {
  const isFinal = match.stage === "final";
  return (
    <motion.div
      layout
      className={cn(
        "rounded-xl border bg-card p-3",
        isFinal ? "border-primary ring-yellow" : "border-border",
      )}
    >
      <div className="mb-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>{match.id}</span>
      </div>
      <Side
        flag={match.home?.team.flag}
        name={match.home?.team.name ?? match.homeLabel}
        unknown={!match.home}
      />
      <div className="my-1 border-t border-dashed border-border" />
      <Side
        flag={match.away?.team.flag}
        name={match.away?.team.name ?? match.awayLabel}
        unknown={!match.away}
      />
      <div className="mt-2 flex items-center justify-center">
        <ScoreEditor fixtureId={match.id} compact />
      </div>
    </motion.div>
  );
}

function Side({ flag, name, unknown }: { flag?: string; name: string; unknown: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", unknown && "text-muted-foreground")}>
      <span className="w-5 text-base">{flag ?? "•"}</span>
      <span className={cn("truncate", !unknown && "font-semibold")}>{name}</span>
    </div>
  );
}
