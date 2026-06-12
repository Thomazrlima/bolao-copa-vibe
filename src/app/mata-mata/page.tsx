"use client";

import { useEffect, useState } from "react";
import { Network, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

type TeamSlot = {
  grupo: string;
  time: string;
  posicao: 1 | 2 | 3;
  pontuacao: number;
  saldo_gols: number;
  gols_pro: number;
};

type KnockoutMatch = {
  id: string;
  fase: "16-avos" | "Oitavas" | "Quartas" | "Semifinal" | "Disputa de 3º" | "Final";
  time1: TeamSlot | null;
  time2: TeamSlot | null;
  label1: string;
  label2: string;
};

type KnockoutBracket = {
  terceirosClassificados: TeamSlot[];
  matrizKey: string | null;
  r32: KnockoutMatch[];
  r16: KnockoutMatch[];
  quartas: KnockoutMatch[];
  semifinais: KnockoutMatch[];
  terceiro: KnockoutMatch;
  final: KnockoutMatch;
};

export default function MataMataPage() {
  const [bracket, setBracket] = useState<KnockoutBracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBracket() {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/mata-mata", { cache: "no-store" });
      const body = await response.json();

      if (!active) return;

      if (!response.ok) {
        setError(body.error ?? "Não foi possível carregar o mata-mata.");
        setLoading(false);
        return;
      }

      setBracket(body.mataMata ?? null);
      setLoading(false);
    }

    loadBracket();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Mata-Mata</h2>
        <p className="text-sm text-muted-foreground">
          Chave oficial projetada pela classificação atual dos grupos
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {bracket ? (
        <>
          <SummaryCard bracket={bracket} />

          <div className="-mx-3 snap-x snap-mandatory overflow-x-auto px-3 pb-4 [scrollbar-width:thin] sm:mx-0 sm:px-0">
            <div className="flex min-w-fit gap-3 sm:gap-6">
              <Round title="16-avos" matches={bracket.r32} />
              <Round title="Oitavas" matches={bracket.r16} />
              <Round title="Quartas" matches={bracket.quartas} />
              <Round title="Semis" matches={bracket.semifinais} />
              <Round title="Final" matches={[bracket.final]} highlight />
            </div>
          </div>

          <section className="mt-8">
            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Disputa de 3º Lugar
            </h3>
            <div className="max-w-md">
              <MatchPill match={bracket.terceiro} />
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          Chave indisponível.
        </div>
      )}
    </>
  );
}

function SummaryCard({ bracket }: { bracket: KnockoutBracket }) {
  return (
    <div className="mb-8 overflow-hidden rounded-lg border border-primary/40 bg-card p-4 ring-yellow sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground sm:h-14 sm:w-14">
            <Network className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Projeção oficial
            </p>
            <h3 className="font-display text-lg font-black tracking-tight sm:text-2xl">
              16-avos definidos por grupos e melhores terceiros
            </h3>
            <p className="text-sm text-muted-foreground">
              Matriz {bracket.matrizKey ?? "pendente"} · sem simulação de placares nesta etapa
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap gap-1.5 lg:max-w-md lg:justify-end">
          {bracket.terceirosClassificados.map((team) => (
            <span
              key={`${team.grupo}-${team.time}`}
              className="rounded-full border border-border bg-background/60 px-2 py-1 text-[11px] font-semibold"
            >
              3{team.grupo} · {team.time}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Round({
  title,
  matches,
  highlight,
}: {
  title: string;
  matches: KnockoutMatch[];
  highlight?: boolean;
}) {
  return (
    <div className="flex w-[calc(100vw-2.5rem)] max-w-[292px] shrink-0 snap-start flex-col gap-3 sm:w-[272px]">
      <h3
        className={cn(
          "sticky top-0 z-10 rounded-md px-2 py-1 text-center font-display text-xs font-bold uppercase tracking-[0.2em]",
          highlight ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
        )}
      >
        {title}
      </h3>
      <div className="flex flex-1 flex-col justify-around gap-3">
        {matches.map((match) => (
          <MatchPill key={match.id} match={match} />
        ))}
      </div>
    </div>
  );
}

function MatchPill({ match }: { match: KnockoutMatch }) {
  const isFinal = match.fase === "Final";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3",
        isFinal ? "border-primary ring-yellow" : "border-border",
      )}
    >
      <div className="mb-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>{match.id}</span>
        <span>{match.fase}</span>
      </div>
      <Side team={match.time1} fallback={match.label1} />
      <div className="my-2 border-t border-dashed border-border" />
      <Side team={match.time2} fallback={match.label2} />
    </div>
  );
}

function Side({ team, fallback }: { team: TeamSlot | null; fallback: string }) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-2 text-sm", !team && "text-muted-foreground")}
    >
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-md text-[10px] font-black",
          team ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {team ? team.grupo : "?"}
      </span>
      <div className="min-w-0">
        <p className={cn("truncate", team && "font-semibold")}>{team?.time ?? fallback}</p>
        {team && (
          <p className="text-[10px] text-muted-foreground">
            {team.posicao}º Grupo {team.grupo} · {team.pontuacao} pts · SG{" "}
            {formatSigned(team.saldo_gols)}
          </p>
        )}
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <>
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Mata-Mata</h2>
        <p className="text-sm text-muted-foreground">Carregando chave...</p>
      </div>
      <div className="mb-8 h-28 rounded-lg border border-primary/40 bg-card/60" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-28 rounded-lg border border-border bg-card/60" />
        ))}
      </div>
    </>
  );
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : value;
}
