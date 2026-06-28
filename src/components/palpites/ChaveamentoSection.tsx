"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Clock3, GitBranch, LockKeyhole, Pencil, Save, Trophy } from "lucide-react";

import { Flag } from "@/components/common/Flag";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { teamCodeFromName } from "@/data/iso2";
import type { ChaveamentoConfronto, PalpiteChaveamentoResponse } from "@/lib/queries";
import { formatLocalGameDateTime } from "@/lib/local-datetime";
import { cn } from "@/lib/utils";

type ChaveamentoConfrontoInput = {
  fase_id: number;
  slot: number;
  time1: string;
  time2: string;
  vencedor: string;
};

type DerivedMatch = ChaveamentoConfronto & {
  time1: string | null;
  time2: string | null;
  vencedor: string | null;
};

type DerivedPhase = Omit<PalpiteChaveamentoResponse["fases"][number], "confrontos"> & {
  confrontos: DerivedMatch[];
};

type DraftWinners = Record<string, string | null>;

type ConnectorSegment = {
  id: string;
  d: string;
  active: boolean;
};

type BracketSide = "left" | "right" | "center";

type DisplayHeader = {
  id: string;
  phase: DerivedPhase;
  phaseIndex: number;
  column: number;
};

type DisplayMatch = {
  match: DerivedMatch;
  column: number;
  rowStart: number;
  rowSpan: number;
};

type Props = {
  bracket: PalpiteChaveamentoResponse;
  saving?: boolean;
  previewMode?: boolean;
  onSave: (confrontos: ChaveamentoConfrontoInput[]) => void | Promise<void>;
};

function matchKey(faseId: number, slot: number) {
  return `${faseId}:${slot}`;
}

function initialWinners(bracket: PalpiteChaveamentoResponse) {
  return Object.fromEntries(
    bracket.fases.flatMap((phase) =>
      phase.confrontos.flatMap((match) =>
        match.vencedor ? [[matchKey(match.fase_id, match.slot), match.vencedor]] : [],
      ),
    ),
  );
}

function winnersSignature(bracket: PalpiteChaveamentoResponse) {
  return bracket.fases
    .flatMap((phase) =>
      phase.confrontos.map(
        (match) =>
          `${matchKey(match.fase_id, match.slot)}:${match.time1 ?? ""}:${match.time2 ?? ""}:${
            match.vencedor ?? ""
          }`,
      ),
    )
    .join("|");
}

function derivePhases(bracket: PalpiteChaveamentoResponse, winners: DraftWinners): DerivedPhase[] {
  let previousWinners: Array<string | null> = [];

  return bracket.fases.map((phase, phaseIndex) => {
    const confrontos = phase.confrontos.map((match) => {
      const generatedTime1 = phaseIndex > 0 ? (previousWinners[match.slot * 2] ?? null) : null;
      const generatedTime2 = phaseIndex > 0 ? (previousWinners[match.slot * 2 + 1] ?? null) : null;
      const time1 = generatedTime1 ?? match.time1;
      const time2 = generatedTime2 ?? match.time2;
      const key = matchKey(match.fase_id, match.slot);
      const chosen = Object.prototype.hasOwnProperty.call(winners, key)
        ? winners[key]
        : match.vencedor;
      const vencedor = chosen && (chosen === time1 || chosen === time2) ? chosen : null;

      return {
        ...match,
        time1,
        time2,
        vencedor,
      };
    });

    previousWinners = confrontos.map((match) => match.vencedor);
    return { ...phase, confrontos };
  });
}

function completeMatches(phases: DerivedPhase[]) {
  return phases.flatMap((phase) =>
    phase.confrontos.flatMap((match) =>
      match.time1 && match.time2 && match.vencedor
        ? [
            {
              fase_id: match.fase_id,
              slot: match.slot,
              time1: match.time1,
              time2: match.time2,
              vencedor: match.vencedor,
            },
          ]
        : [],
    ),
  );
}

function phaseSide(phaseIndex: number, slot: number, phases: DerivedPhase[]): BracketSide {
  const finalPhaseIndex = phases.length - 1;
  if (phaseIndex >= finalPhaseIndex) return "center";

  return slot < phases[phaseIndex].confrontos.length / 2 ? "left" : "right";
}

function bracketColumn(phaseIndex: number, side: BracketSide, totalPhases: number) {
  const centerColumn = totalPhases;
  if (side === "center") return centerColumn;
  if (side === "left") return phaseIndex + 1;

  return centerColumn + (totalPhases - phaseIndex - 1);
}

function buildDisplayHeaders(phases: DerivedPhase[]): DisplayHeader[] {
  const finalPhaseIndex = phases.length - 1;
  const headers = phases.flatMap((phase, phaseIndex) => {
    if (phaseIndex === finalPhaseIndex) {
      return [
        {
          id: `${phase.fase_id}:center`,
          phase,
          phaseIndex,
          column: bracketColumn(phaseIndex, "center", phases.length),
        },
      ];
    }

    return [
      {
        id: `${phase.fase_id}:left`,
        phase,
        phaseIndex,
        column: bracketColumn(phaseIndex, "left", phases.length),
      },
      {
        id: `${phase.fase_id}:right`,
        phase,
        phaseIndex,
        column: bracketColumn(phaseIndex, "right", phases.length),
      },
    ];
  });

  return headers.sort((first, second) => first.column - second.column);
}

function buildDisplayMatches(phases: DerivedPhase[], boardRowCount: number): DisplayMatch[] {
  const finalPhaseIndex = phases.length - 1;

  return phases.flatMap((phase, phaseIndex) =>
    phase.confrontos.map((match) => {
      const side = phaseSide(phaseIndex, match.slot, phases);
      const sideMatchCount = Math.max(1, phase.confrontos.length / (side === "center" ? 1 : 2));
      const localSlot = side === "right" ? match.slot - sideMatchCount : match.slot;
      const rowSpan =
        phaseIndex === finalPhaseIndex
          ? boardRowCount
          : Math.max(1, boardRowCount / sideMatchCount);

      return {
        match,
        column: bracketColumn(phaseIndex, side, phases.length),
        rowStart: localSlot * rowSpan + 2,
        rowSpan,
      };
    }),
  );
}

export function ChaveamentoSection({
  bracket,
  saving = false,
  previewMode = false,
  onSave,
}: Props) {
  const [winners, setWinners] = useState<DraftWinners>(() => initialWinners(bracket));
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState(false);
  const [connectorSegments, setConnectorSegments] = useState<ConnectorSegment[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const savedWinnersSignature = useMemo(() => winnersSignature(bracket), [bracket]);
  const lastSyncedWinnersSignatureRef = useRef(savedWinnersSignature);

  useEffect(() => {
    if (hasLocalChanges || lastSyncedWinnersSignatureRef.current === savedWinnersSignature) return;

    setWinners(initialWinners(bracket));
    lastSyncedWinnersSignatureRef.current = savedWinnersSignature;
  }, [bracket, hasLocalChanges, savedWinnersSignature]);

  const phases = useMemo(() => derivePhases(bracket, winners), [bracket, winners]);
  const bracketColumnCount = Math.max(1, phases.length * 2 - 1);
  const boardRowCount = Math.max(1, phases[0]?.confrontos.length ?? 1);
  const displayHeaders = useMemo(() => buildDisplayHeaders(phases), [phases]);
  const displayMatches = useMemo(
    () => buildDisplayMatches(phases, boardRowCount),
    [phases, boardRowCount],
  );
  const picks = completeMatches(phases);
  const expected = phases.reduce((sum, phase) => sum + phase.total_confrontos, 0);
  const progress = expected ? Math.round((picks.length / expected) * 100) : 0;
  const canSave = bracket.aberto && picks.length > 0 && !saving;
  const scoringMatches = phases
    .filter((phase) => phase.pontuavel)
    .reduce((sum, phase) => sum + phase.total_confrontos, 0);

  useLayoutEffect(() => {
    function updateConnectors() {
      const boardElement = boardRef.current;
      if (!boardElement) return;

      const boardRect = boardElement.getBoundingClientRect();
      const nextSegments: ConnectorSegment[] = [];

      phases.slice(0, -1).forEach((phase, phaseIndex) => {
        const nextPhase = phases[phaseIndex + 1];
        if (!nextPhase) return;

        nextPhase.confrontos.forEach((parentMatch) => {
          const topMatch = phase.confrontos[parentMatch.slot * 2];
          const bottomMatch = phase.confrontos[parentMatch.slot * 2 + 1];
          if (!topMatch || !bottomMatch) return;

          const topElement = cardRefs.current.get(matchKey(topMatch.fase_id, topMatch.slot));
          const bottomElement = cardRefs.current.get(
            matchKey(bottomMatch.fase_id, bottomMatch.slot),
          );
          const parentElement = cardRefs.current.get(
            matchKey(parentMatch.fase_id, parentMatch.slot),
          );
          if (!topElement || !bottomElement || !parentElement) return;

          const topRect = topElement.getBoundingClientRect();
          const bottomRect = bottomElement.getBoundingClientRect();
          const parentRect = parentElement.getBoundingClientRect();
          const parentCenterX = parentRect.left + parentRect.width / 2;
          const topCenterX = topRect.left + topRect.width / 2;
          const bottomCenterX = bottomRect.left + bottomRect.width / 2;
          const topStartsLeft = topCenterX < parentCenterX;
          const bottomStartsLeft = bottomCenterX < parentCenterX;
          const topStartX = (topStartsLeft ? topRect.right : topRect.left) - boardRect.left;
          const bottomStartX =
            (bottomStartsLeft ? bottomRect.right : bottomRect.left) - boardRect.left;
          const topEndX = (topStartsLeft ? parentRect.left : parentRect.right) - boardRect.left;
          const bottomEndX =
            (bottomStartsLeft ? parentRect.left : parentRect.right) - boardRect.left;
          const topY = topRect.top + topRect.height / 2 - boardRect.top;
          const bottomY = bottomRect.top + bottomRect.height / 2 - boardRect.top;
          const parentY = parentRect.top + parentRect.height / 2 - boardRect.top;
          const id = `${phase.fase_id}:${parentMatch.slot}`;
          const connectorActive = Boolean(topMatch.vencedor && bottomMatch.vencedor);

          if (topStartsLeft !== bottomStartsLeft) {
            nextSegments.push(
              {
                id: `${id}:top`,
                d: `M ${topStartX} ${topY} H ${topEndX}`,
                active: Boolean(topMatch.vencedor),
              },
              {
                id: `${id}:bottom`,
                d: `M ${bottomStartX} ${bottomY} H ${bottomEndX}`,
                active: Boolean(bottomMatch.vencedor),
              },
            );
            return;
          }

          const startX = topStartX;
          const endX = topEndX;
          const stemX = startX + (endX - startX) * 0.62;

          nextSegments.push(
            {
              id: `${id}:top`,
              d: `M ${topStartX} ${topY} H ${stemX}`,
              active: Boolean(topMatch.vencedor),
            },
            {
              id: `${id}:bottom`,
              d: `M ${bottomStartX} ${bottomY} H ${stemX}`,
              active: Boolean(bottomMatch.vencedor),
            },
            {
              id: `${id}:stem`,
              d: `M ${stemX} ${topY} V ${bottomY}`,
              active: connectorActive,
            },
            {
              id: `${id}:parent`,
              d: `M ${stemX} ${parentY} H ${endX}`,
              active: connectorActive,
            },
          );
        });
      });

      setConnectorSegments((current) =>
        connectorSegmentsEqual(current, nextSegments) ? current : nextSegments,
      );
    }

    updateConnectors();

    const boardElement = boardRef.current;
    if (!boardElement) return;

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateConnectors);
      return () => window.removeEventListener("resize", updateConnectors);
    }

    const resizeObserver = new ResizeObserver(updateConnectors);
    resizeObserver.observe(boardElement);
    cardRefs.current.forEach((element) => resizeObserver.observe(element));
    window.addEventListener("resize", updateConnectors);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateConnectors);
    };
  }, [phases]);

  function selectWinner(match: DerivedMatch, team: string) {
    if (!bracket.aberto || !match.time1 || !match.time2) return;
    setWinners((current) => {
      const key = matchKey(match.fase_id, match.slot);
      const next = Object.fromEntries(
        Object.entries(current).filter(([entryKey]) => {
          const [faseId] = entryKey.split(":");
          return Number(faseId) <= match.fase_id;
        }),
      );

      if (current[key] === team) {
        next[key] = null;
      } else {
        next[key] = team;
      }

      return next;
    });
    setHasLocalChanges(true);
    setRecentlySaved(false);
  }

  async function save() {
    if (!canSave) return;

    try {
      await onSave(picks);
    } catch {
      return;
    }

    setHasLocalChanges(false);
    lastSyncedWinnersSignatureRef.current = winnersSignature({
      ...bracket,
      fases: phases,
    });
    setRecentlySaved(true);
  }

  if (!bracket.disponivel) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        O chaveamento aparece quando os primeiros confrontos do mata-mata estiverem definidos.
      </div>
    );
  }

  return (
    <section>
      <div className="mb-6 overflow-hidden rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/14 via-card to-card p-4 ring-yellow sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground sm:h-14 sm:w-14">
              <GitBranch className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                {previewMode ? "Preview visual" : "Palpite de chaveamento"}
              </p>
              <h3 className="mt-1 font-display text-lg font-black leading-tight sm:text-2xl">
                Monte seu caminho até a final
              </h3>
            </div>
          </div>

          <div>
            <div className="mb-2 grid grid-cols-3 gap-2 text-center">
              <BracketMetric label="Preenchido" value={`${progress}%`} />
              <BracketMetric label="Pontos" value={bracket.pontos} />
              <BracketMetric label="Acertos" value={`${bracket.acertos}/${scoringMatches}`} />
            </div>
            <Progress value={progress} className="h-3" />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                {bracket.aberto ? (
                  <>
                    <Clock3 className="h-3.5 w-3.5 text-primary" />
                    Prazo: {formatDeadline(bracket.prazo_envio)}
                  </>
                ) : (
                  <>
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Chaveamento encerrado
                  </>
                )}
              </span>
              <Button
                type="button"
                size="sm"
                disabled={!canSave}
                onClick={save}
                className="gap-1.5"
                variant={bracket.salvo ? "secondary" : "default"}
              >
                {!bracket.aberto ? (
                  <>
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Encerrado
                  </>
                ) : recentlySaved ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Salvo
                  </>
                ) : bracket.salvo ? (
                  <>
                    <Pencil className="h-3.5 w-3.5" />
                    {saving ? "Atualizando..." : "Atualizar"}
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    {saving ? "Salvando..." : "Salvar chave"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="-mx-3 overflow-x-auto px-3 pb-5 pt-1 [scrollbar-width:thin] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div
          ref={boardRef}
          className="relative grid min-w-fit gap-x-[var(--bracket-gap)] gap-y-3 [--bracket-column-w:min(286px,calc(100vw-2.5rem))] [--bracket-gap:1rem] sm:[--bracket-column-w:272px] sm:[--bracket-gap:1.25rem]"
          style={{
            gridTemplateColumns: `repeat(${bracketColumnCount}, var(--bracket-column-w))`,
            gridTemplateRows: `auto repeat(${boardRowCount}, auto)`,
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full overflow-visible sm:block"
            aria-hidden="true"
          >
            {connectorSegments.map((segment) => (
              <path
                key={segment.id}
                d={segment.d}
                fill="none"
                strokeLinecap="butt"
                strokeWidth="3"
                className={cn(
                  "stroke-border",
                  segment.active && "stroke-primary [filter:drop-shadow(0_0_6px_var(--primary))]",
                )}
              />
            ))}
          </svg>

          {displayHeaders.map(({ id, phase, phaseIndex, column }) => (
            <div
              key={id}
              className="relative z-10 flex items-center rounded-xl border border-border bg-card/95 px-3 py-2.5 text-left"
              style={{ gridColumn: column, gridRow: 1 }}
            >
              <span className="mr-2 grid h-7 w-7 place-items-center rounded-lg bg-primary/12 font-display text-xs font-black text-primary">
                {phaseIndex + 1}
              </span>
              <span>
                <span className="block font-display text-sm font-black">{phase.nome}</span>
                <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">
                  {phase.total_confrontos} {phase.total_confrontos === 1 ? "jogo" : "jogos"}
                </span>
              </span>
              <span className="ml-auto text-[10px] font-bold opacity-70">
                {phase.pontuavel ? "+5" : "0"} pts
              </span>
            </div>
          ))}

          {displayMatches.map(({ match, column, rowStart, rowSpan }) => {
            const gridStyle: CSSProperties = {
              gridColumn: column,
              gridRow: `${rowStart} / span ${rowSpan}`,
            };

            return (
              <div
                key={matchKey(match.fase_id, match.slot)}
                ref={(element) => {
                  const key = matchKey(match.fase_id, match.slot);
                  if (element) cardRefs.current.set(key, element);
                  else cardRefs.current.delete(key);
                }}
                className="relative z-10 self-center"
                style={gridStyle}
              >
                <BracketPickCard
                  match={match}
                  open={bracket.aberto}
                  showFallback={match.fase_id === bracket.inicial_fase_id}
                  onSelect={selectWinner}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function connectorSegmentsEqual(current: ConnectorSegment[], next: ConnectorSegment[]) {
  if (current.length !== next.length) return false;

  return current.every((segment, index) => {
    const nextSegment = next[index];
    return (
      nextSegment &&
      segment.id === nextSegment.id &&
      segment.d === nextSegment.d &&
      segment.active === nextSegment.active
    );
  });
}

function BracketMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/80 bg-background/55 px-3 py-3 text-center backdrop-blur">
      <div className="num font-display text-xl font-black text-primary">{value}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function BracketPickCard({
  match,
  open,
  showFallback,
  onSelect,
}: {
  match: DerivedMatch;
  open: boolean;
  showFallback: boolean;
  onSelect: (match: DerivedMatch, team: string) => void;
}) {
  const canPick = open && Boolean(match.time1 && match.time2);

  return (
    <article
      className={cn(
        "relative w-full overflow-visible rounded-xl border bg-card text-left shadow-[0_14px_30px_-28px_rgba(0,0,0,0.95)]",
        match.vencedor
          ? "border-primary shadow-[0_8px_30px_-18px_var(--primary)]"
          : "border-border focus-within:border-primary/60",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/70 bg-background/35 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
        <span>{match.fase}</span>
        <span>Jogo {match.slot + 1}</span>
      </div>
      <div className="px-3 py-2.5">
        <TeamPickSide
          team={match.time1}
          fallback={showFallback ? "A definir" : ""}
          selected={Boolean(match.time1) && match.vencedor === match.time1}
          disabled={!canPick}
          onSelect={() => match.time1 && onSelect(match, match.time1)}
        />
        <div className="my-2 flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[8px] font-black uppercase text-muted-foreground">x</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <TeamPickSide
          team={match.time2}
          fallback={showFallback ? "A definir" : ""}
          selected={Boolean(match.time2) && match.vencedor === match.time2}
          disabled={!canPick}
          onSelect={() => match.time2 && onSelect(match, match.time2)}
        />
      </div>
    </article>
  );
}

function TeamPickSide({
  team,
  fallback,
  selected,
  disabled,
  onSelect,
}: {
  team: string | null;
  fallback: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || !team}
      onClick={onSelect}
      className={cn(
        "flex min-h-9 w-full min-w-0 items-center gap-2.5 rounded-lg border border-transparent px-2 py-1 text-left transition-[background-color,border-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_14px_-8px_var(--primary)]"
          : team && !disabled && "hover:border-primary/40 hover:bg-primary/10",
        team && !disabled && "cursor-pointer hover:translate-x-0.5",
        (!team || disabled) && "cursor-not-allowed text-muted-foreground",
      )}
    >
      {team ? (
        <>
          <Flag code={teamCodeFromName(team)} name={team} size="md" static />
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{team}</span>
          {selected && (
            <span className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/15 font-display text-[10px] font-black text-primary">
              <Trophy className="h-3.5 w-3.5" />
            </span>
          )}
        </>
      ) : (
        <span className="truncate text-sm">{fallback}</span>
      )}
    </button>
  );
}

function formatDeadline(value: string | null) {
  if (!value) return "a definir";
  return formatLocalGameDateTime(value, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
