"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CircleHelp,
  Clock3,
  Flame,
  Goal,
  Settings,
  Trophy,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/common/Flag";
import { buildMockProfile, getFixtureTeams, type MockProfileGuess } from "@/data/mock-profiles";
import { TEAM_BY_CODE } from "@/data/teams";
import { getInitials } from "@/lib/display-name";
import { cn } from "@/lib/utils";
import type { GuessOutcome } from "@/lib/scoring";

const STAT_CARDS: Array<{
  outcome: GuessOutcome;
  label: string;
  points: number;
  icon: typeof Trophy;
  className: string;
  pointsClassName: string;
}> = [
  {
    outcome: "chinelada",
    label: "Chinelada",
    points: 10,
    icon: Trophy,
    className: "border-primary/40 bg-primary/10 text-primary",
    pointsClassName: "text-primary",
  },
  {
    outcome: "strong",
    label: "Na trave",
    points: 7,
    icon: Flame,
    className: "border-warning/40 bg-warning/10 text-warning",
    pointsClassName: "text-warning",
  },
  {
    outcome: "result",
    label: "Só o básico",
    points: 5,
    icon: Check,
    className: "border-success/40 bg-success/10 text-success",
    pointsClassName: "text-success",
  },
  {
    outcome: "goals",
    label: "Deu sorte",
    points: 2,
    icon: Goal,
    className: "border-border bg-card text-foreground",
    pointsClassName: "text-foreground",
  },
  {
    outcome: "miss",
    label: "Sabe nada",
    points: 0,
    icon: CircleHelp,
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    pointsClassName: "text-destructive",
  },
];

const PROFILE_BADGES = {
  "mae-dina": {
    emoji: "🔮",
    label: "Mãe Diná",
    description: "Líder do ranking.",
    className: "border-primary/45 bg-primary/10 text-primary",
  },
  "no-cangote": {
    emoji: "👃",
    label: "No Cangote",
    description: "Segundo colocado do ranking.",
    className: "border-zinc-300/40 bg-zinc-300/10 text-zinc-200",
  },
  "podio-e-podio": {
    emoji: "😎",
    label: "Pódio é Pódio",
    description: "Terceiro colocado do ranking.",
    className: "border-amber-700/50 bg-amber-800/15 text-amber-500",
  },
  lanterna: {
    emoji: "🔦",
    label: "Lanterna",
    description: "Último colocado do ranking.",
    className: "border-destructive/45 bg-destructive/10 text-destructive",
  },
  chinelada: {
    emoji: "🩴",
    label: "Chinelo de Ouro",
    description: "Maior número de chineladas do bolão, sem empate.",
    className: "border-primary/45 bg-primary/10 text-primary",
  },
} as const;

type ProfileBadgeKey = keyof typeof PROFILE_BADGES;

export default function PerfilPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const requestedName = searchParams.get("nome");
  const requestedPoints = Number(searchParams.get("pontos"));
  const badges =
    searchParams
      .get("badges")
      ?.split(",")
      .filter((badge): badge is ProfileBadgeKey => badge in PROFILE_BADGES) ?? [];
  const profile = useMemo(
    () =>
      buildMockProfile(
        id,
        requestedName,
        Number.isFinite(requestedPoints) && searchParams.has("pontos") ? requestedPoints : null,
      ),
    [id, requestedName, requestedPoints, searchParams],
  );
  const isCurrentUser = id === "me";
  const [photo, setPhoto] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState(profile.name);

  useEffect(() => {
    if (!isCurrentUser) {
      setPhoto(null);
      setCurrentName(profile.name);
      return;
    }

    setPhoto(window.localStorage.getItem("mock-profile-photo"));
    setCurrentName(window.localStorage.getItem("mock-profile-name") || profile.name);
  }, [isCurrentUser, profile.name]);

  return (
    <div className="mx-auto max-w-5xl">
      <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card/90 p-5 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 to-transparent" />
        {isCurrentUser && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="absolute right-3 top-3 z-10 h-9 w-9 border border-border/70 bg-background/55 p-0 backdrop-blur hover:border-primary hover:bg-primary hover:text-primary-foreground sm:right-5 sm:top-5 sm:w-auto sm:px-3"
          >
            <Link href="/configuracoes" aria-label="Abrir configurações do perfil">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </Link>
          </Button>
        )}
        <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <Avatar className="h-28 w-28 border-2 border-primary/60 bg-primary/10 shadow-[0_0_35px_color-mix(in_oklab,var(--primary)_20%,transparent)] sm:h-36 sm:w-36">
            {photo && <AvatarImage src={photo} alt={currentName} className="object-cover" />}
            <AvatarFallback className="bg-primary/15 font-display text-3xl font-black text-primary sm:text-4xl">
              {getInitials(currentName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Perfil do participante
            </p>
            <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
              {currentName}
            </h1>
            {badges.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                {badges.map((badgeKey) => {
                  const badge = PROFILE_BADGES[badgeKey];

                  return (
                    <span
                      key={badgeKey}
                      title={badge.description}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
                        badge.className,
                      )}
                    >
                      <span className="text-base leading-none" role="img" aria-hidden="true">
                        {badge.emoji}
                      </span>
                      {badge.label}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex items-end justify-center gap-2 sm:justify-start">
              <span className="font-display text-5xl font-black text-primary num">
                {profile.points}
              </span>
              <span className="pb-1 text-xs font-black uppercase tracking-wider text-muted-foreground">
                pontos
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 font-display text-lg font-black">Desempenho</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {STAT_CARDS.map(({ outcome, label, points, icon: Icon, className }) => (
            <div key={outcome} className={cn("rounded-xl border p-3 sm:p-4", className)}>
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-4 w-4" />
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">
                  {points} pts
                </span>
              </div>
              <div className="mt-4 font-display text-3xl font-black num">
                {profile.stats[outcome]}
              </div>
              <div className="mt-0.5 text-[10px] font-black uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-black">Todos os palpites</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Jogos encerrados já exibem a pontuação conquistada.
            </p>
          </div>
          <span className="shrink-0 text-xs font-bold text-muted-foreground">
            {profile.guesses.length} jogos
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {profile.guesses.map((guess) => (
            <GuessCard key={guess.fixture.id} guess={guess} />
          ))}
        </div>
      </section>
    </div>
  );
}

function GuessCard({ guess }: { guess: MockProfileGuess }) {
  const teams = getFixtureTeams(guess.fixture);
  const outcome = guess.outcome ? STAT_CARDS.find((item) => item.outcome === guess.outcome) : null;
  const OutcomeIcon = outcome?.icon;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card/90">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(guess.fixture.kickoff)}
        </span>
        {outcome ? (
          <span className={cn("flex items-center gap-1", outcome.className.split(" ").at(-1))}>
            {OutcomeIcon && <OutcomeIcon className="h-3.5 w-3.5" />}
            {outcome.label}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Aguardando jogo
          </span>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 p-3 sm:p-4">
        <Team code={guess.fixture.homeCode} name={teams.home} />
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Palpite
          </p>
          <p className="mt-1 whitespace-nowrap font-display text-2xl font-black num">
            {guess.guess.home} <span className="text-muted-foreground">x</span> {guess.guess.away}
          </p>
        </div>
        <Team code={guess.fixture.awayCode} name={teams.away} right />
      </div>

      <div className="flex items-center justify-between gap-3 bg-background/45 px-3 py-2.5 text-xs sm:px-4">
        {guess.result ? (
          <span className="text-muted-foreground">
            Resultado:{" "}
            <strong className="text-foreground num">
              {guess.result.home} x {guess.result.away}
            </strong>
          </span>
        ) : (
          <span className="text-muted-foreground">Resultado ainda não disponível</span>
        )}
        <span
          className={cn(
            "font-display text-base font-black num",
            guess.points == null
              ? "text-muted-foreground"
              : (outcome?.pointsClassName ?? "text-foreground"),
          )}
        >
          {guess.points == null ? "—" : `+${guess.points} pts`}
        </span>
      </div>
    </article>
  );
}

function Team({ code, name, right = false }: { code?: string; name: string; right?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", right && "flex-row-reverse text-right")}>
      <Flag code={code} name={name} static />
      <span className="min-w-0 truncate text-xs font-bold sm:text-sm">
        {code ? (TEAM_BY_CODE[code]?.name ?? name) : name}
      </span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
