"use client";

import Link from "next/link";
import { AlertTriangle, BellRing, Clock3 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import {
  formatPalpiteTimeRemaining,
  getPalpiteDeadline,
  nowAsStoredBrasiliaMs,
  PALPITES_UPDATED_EVENT,
  urgencyRank,
  type PalpiteUrgency,
} from "@/lib/palpite-deadlines";
import { getPalpitesDashboard, type PalpitesDashboardResponse } from "@/lib/queries";
import { cn } from "@/lib/utils";

type DashboardGame = PalpitesDashboardResponse["jogos"][number];

export type PendingGuess = {
  game: DashboardGame;
  urgency: PalpiteUrgency;
  remainingMs: number;
};

const URGENCY_META: Record<
  PalpiteUrgency,
  { label: string; surface: string; badge: string; icon: string }
> = {
  reminder: {
    label: "Atenção",
    surface: "border-primary/45 bg-card",
    badge: "border-primary/40 bg-primary/15 text-primary",
    icon: "bg-primary/15 text-primary",
  },
  attention: {
    label: "Urgente",
    surface: "border-warning/50 bg-card",
    badge: "border-warning/45 bg-warning/15 text-warning",
    icon: "bg-warning/15 text-warning",
  },
  critical: {
    label: "Crítico",
    surface: "border-destructive/55 bg-card",
    badge: "border-destructive/45 bg-destructive/15 text-destructive",
    icon: "bg-destructive/15 text-destructive",
  },
  imminent: {
    label: "Últimos minutos",
    surface:
      "border-destructive bg-card shadow-[0_0_34px_color-mix(in_oklab,var(--destructive)_24%,transparent)]",
    badge: "border-destructive bg-destructive text-destructive-foreground",
    icon: "bg-destructive text-destructive-foreground",
  },
};

export function usePendingGuessNotifications() {
  const [games, setGames] = useState<DashboardGame[]>([]);
  const [now, setNow] = useState(() => nowAsStoredBrasiliaMs());
  const [modalOpen, setModalOpen] = useState(false);
  const initialLoadHandled = useRef(false);

  const load = useCallback(async () => {
    try {
      const dashboard = await getPalpitesDashboard();
      setGames(dashboard.jogos);

      if (!initialLoadHandled.current) {
        initialLoadHandled.current = true;
        setModalOpen(getPendingGuesses(dashboard.jogos, nowAsStoredBrasiliaMs()).length > 0);
      }
    } catch {
      setGames([]);
      initialLoadHandled.current = true;
    }
  }, []);

  useEffect(() => {
    void load();

    const interval = window.setInterval(() => setNow(nowAsStoredBrasiliaMs()), 30_000);
    window.addEventListener(PALPITES_UPDATED_EVENT, load);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PALPITES_UPDATED_EVENT, load);
    };
  }, [load]);

  useRealtimeRefresh({
    channelName: "pending-guess-notifications",
    signals: ["jogos", "palpites"],
    onRefresh: load,
    fallbackIntervalMs: 60_000,
  });

  const pending = useMemo(() => getPendingGuesses(games, now), [games, now]);
  const highestUrgency = pending.reduce<PalpiteUrgency | null>(
    (highest, item) =>
      !highest || urgencyRank(item.urgency) > urgencyRank(highest) ? item.urgency : highest,
    null,
  );

  return {
    pending,
    highestUrgency,
    modalOpen: modalOpen && pending.length > 0,
    setModalOpen,
  };
}

export function PendingGuessModal({
  pending,
  open,
  onOpenChange,
}: {
  pending: PendingGuess[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const highestUrgency = pending.reduce<PalpiteUrgency>(
    (highest, item) => (urgencyRank(item.urgency) > urgencyRank(highest) ? item.urgency : highest),
    pending[0]?.urgency ?? "reminder",
  );
  const meta = URGENCY_META[highestUrgency];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(88vh,680px)] w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl p-0 sm:max-w-xl",
          meta.surface,
        )}
      >
        <DialogHeader className="border-b border-current/10 p-5 pr-12 text-left sm:p-6 sm:pr-12">
          <div className={cn("mb-3 grid h-11 w-11 place-items-center rounded-xl", meta.icon)}>
            {highestUrgency === "critical" || highestUrgency === "imminent" ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <BellRing className="h-5 w-5" />
            )}
          </div>
          <DialogTitle className="font-display text-2xl font-black">
            {pending.length === 1
              ? "Você tem 1 palpite pendente"
              : `Você tem ${pending.length} palpites pendentes`}
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            Estes jogos começam em menos de 24 horas. Envie seus placares antes que os palpites
            sejam bloqueados.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-2 overflow-y-auto px-5 sm:px-6">
          {pending.map(({ game, urgency, remainingMs }) => {
            const itemMeta = URGENCY_META[urgency];
            return (
              <div
                key={game.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-background p-3",
                  itemMeta.surface,
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                    itemMeta.icon,
                  )}
                >
                  <Clock3 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-black">
                    {game.time1} x {game.time2}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Fecha em {formatPalpiteTimeRemaining(remainingMs)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider",
                    itemMeta.badge,
                  )}
                >
                  {itemMeta.label}
                </span>
              </div>
            );
          })}
        </div>

        <DialogFooter className="border-t border-current/10 p-5 sm:p-6">
          <Button asChild className="w-full">
            <Link href="/palpites" onClick={() => onOpenChange(false)}>
              Responder agora
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function notificationTone(urgency: PalpiteUrgency | null) {
  if (urgency === "imminent" || urgency === "critical") return "bg-destructive text-white";
  if (urgency === "attention") return "bg-warning text-background";
  return "bg-primary text-primary-foreground";
}

function getPendingGuesses(games: DashboardGame[], now: number) {
  return games
    .flatMap((game): PendingGuess[] => {
      if (game.encerrado || game.iniciado || game.palpite) return [];
      const deadline = getPalpiteDeadline(game.data, now);
      return deadline ? [{ game, ...deadline }] : [];
    })
    .sort((a, b) => a.remainingMs - b.remainingMs);
}
