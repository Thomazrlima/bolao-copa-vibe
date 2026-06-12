"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBolaoStore } from "@/lib/store";
import { computeBracket, type BracketSlot } from "@/lib/bracket";
import { ScoreEditor } from "@/components/common/ScoreEditor";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/common/Flag";
import { useMounted } from "@/hooks/use-mounted";

export default function MataMataPage() {
  const mounted = useMounted();
  const results = useBolaoStore((s) => s.results);
  const bracket = useMemo(() => computeBracket(results), [results]);

  if (!mounted) {
    return (
      <>
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Mata-Mata</h2>
          <p className="text-sm text-muted-foreground">Carregando simulador...</p>
        </div>
        <div className="h-28 rounded-2xl border border-primary/40 bg-card/60" />
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Mata-Mata</h2>
        <p className="text-sm text-muted-foreground">
          Se a Copa terminasse agora · edite qualquer placar para simular
        </p>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-4 ring-yellow sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground sm:h-14 sm:w-14">
            <Trophy className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Campeão projetado
            </p>
            <AnimatePresence mode="wait">
              <motion.h3
                key={bracket.champion?.code ?? "none"}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                className="font-display text-lg font-black tracking-tight min-[380px]:text-xl sm:text-3xl"
              >
                {bracket.champion ? (
                  <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <Flag
                      code={bracket.champion.code}
                      name={bracket.champion.name}
                      size="lg"
                      className="sm:h-11 sm:w-16"
                    />
                    <span className="truncate">{bracket.champion.name}</span>
                  </span>
                ) : (
                  <span className="block text-sm leading-snug text-muted-foreground min-[380px]:text-base sm:text-2xl">
                    Preencha os resultados
                  </span>
                )}
              </motion.h3>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="-mx-3 snap-x snap-mandatory overflow-x-auto px-3 pb-4 [scrollbar-width:thin] sm:mx-0 sm:px-0">
        <div className="flex min-w-fit gap-3 sm:gap-6">
          <Round title="16-avos" matches={bracket.r32} />
          <Round title="Oitavas" matches={bracket.r16} />
          <Round title="Quartas" matches={bracket.qf} />
          <Round title="Semis" matches={bracket.sf} />
          <Round title="Final" matches={[bracket.final]} highlight />
        </div>
      </div>

      <section className="mt-8">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Disputa de 3º Lugar
        </h3>
        <div className="max-w-md">
          <MatchPill match={bracket.third} />
        </div>
      </section>
    </>
  );
}

function Round({
  title,
  matches,
  highlight,
}: {
  title: string;
  matches: BracketSlot[];
  highlight?: boolean;
}) {
  return (
    <div className="flex w-[calc(100vw-2.5rem)] max-w-[280px] shrink-0 snap-start flex-col gap-3 sm:w-[260px]">
      <h3
        className={cn(
          "sticky top-0 z-10 rounded-md px-2 py-1 text-center font-display text-xs font-bold uppercase tracking-[0.2em]",
          highlight ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
        )}
      >
        {title}
      </h3>
      <div className="flex flex-1 flex-col justify-around gap-3">
        {matches.map((m) => (
          <MatchPill key={m.id} match={m} />
        ))}
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
        "rounded-lg border bg-card p-3",
        isFinal ? "border-primary ring-yellow" : "border-border",
      )}
    >
      <div className="mb-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>{match.id}</span>
      </div>
      <Side
        code={match.home?.team.code}
        name={match.home?.team.name ?? match.homeLabel}
        unknown={!match.home}
      />
      <div className="my-1 border-t border-dashed border-border" />
      <Side
        code={match.away?.team.code}
        name={match.away?.team.name ?? match.awayLabel}
        unknown={!match.away}
      />
      <div className="mt-2 flex items-center justify-center">
        <ScoreEditor fixtureId={match.id} compact />
      </div>
    </motion.div>
  );
}

function Side({ code, name, unknown }: { code?: string; name: string; unknown: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", unknown && "text-muted-foreground")}>
      {code ? (
        <Flag code={code} name={name} size="md" />
      ) : (
        <span className="w-6 text-center text-base">•</span>
      )}
      <span className={cn("truncate", !unknown && "font-semibold")}>{name}</span>
    </div>
  );
}
