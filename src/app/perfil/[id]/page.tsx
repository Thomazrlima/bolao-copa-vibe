"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import brazilFlag from "@/app/flag.png";
import {
  CalendarDays,
  Check,
  CircleHelp,
  Clock3,
  Flame,
  Goal,
  Radio,
  Settings,
  Sparkles,
  Trophy,
} from "lucide-react";

import { UserAvatar } from "@/components/common/UserAvatar";
import { MatchDateGroups } from "@/components/common/MatchDateGroups";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/common/Flag";
import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teamCodeFromName } from "@/data/iso2";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { getPerfil, type PerfilPalpite, type PerfilUsuario } from "@/lib/queries";
import { RANKING_BADGES } from "@/lib/ranking-badges";
import { cn } from "@/lib/utils";
import { formatLocalGameDateTime } from "@/lib/local-datetime";
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

type GuessStatusFilter = "all" | "finished" | "pending";
type GuessOutcomeFilter = "all" | GuessOutcome;

export default function PerfilPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [profile, setProfile] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<GuessStatusFilter>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<GuessOutcomeFilter>("all");
  const [phaseFilter, setPhaseFilter] = useState("all");

  const loadProfile = useCallback(
    async ({ showLoading = false } = {}) => {
      if (showLoading) setLoading(true);
      setError(null);

      try {
        setProfile(await getPerfil(id));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Não foi possível carregar o perfil.",
        );
        setProfile(null);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void loadProfile({ showLoading: true });
  }, [loadProfile]);

  useRealtimeRefresh({
    channelName: `perfil-live:${id}`,
    signals: ["jogos", "ranking", "palpites"],
    onRefresh: loadProfile,
  });

  if (loading) {
    return <SpinningBallLoader label="Carregando perfil" />;
  }

  if (error || !profile) {
    return <ProfileState message={error ?? "Perfil não encontrado."} destructive />;
  }

  const phases = [...new Set(profile.palpites.map((guess) => guess.fase))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const filteredGuesses = profile.palpites.filter((guess) => {
    if (statusFilter === "finished" && !guess.encerrado) return false;
    if (statusFilter === "pending" && guess.encerrado) return false;
    if (outcomeFilter !== "all" && guess.outcome !== outcomeFilter) return false;
    if (phaseFilter !== "all" && guess.fase !== phaseFilter) return false;
    return true;
  });
  const openGuesses = filteredGuesses.filter((guess) => !guess.encerrado);
  const finishedGuesses = filteredGuesses.filter((guess) => guess.encerrado);
  const pointsByOutcome = Object.fromEntries(
    STAT_CARDS.map((card) => [
      card.outcome,
      profile.palpites
        .filter((guess) => guess.outcome === card.outcome)
        .reduce((total, guess) => total + (guess.pontos ?? 0), 0),
    ]),
  ) as Record<GuessOutcome, number>;

  return (
    <div className="mx-auto max-w-5xl">
      <section className="brazil-profile-banner relative isolate overflow-hidden rounded-2xl border border-primary/25 bg-card/90 p-5 sm:p-8">
        <img
          src={brazilFlag.src}
          alt=""
          className="brazil-profile-banner-image absolute inset-0 hidden h-full w-full object-cover"
          aria-hidden="true"
        />
        <div className="brazil-profile-banner-glow absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 to-transparent" />
        {profile.is_current_user && (
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
          <UserAvatar
            name={profile.nome_completo}
            avatarPath={profile.avatar_url}
            className="h-28 w-28 border-2 border-primary/60 bg-primary/10 shadow-[0_0_35px_color-mix(in_oklab,var(--primary)_20%,transparent)] sm:h-36 sm:w-36"
            fallbackClassName="bg-primary/15 font-display text-3xl font-black text-primary sm:text-4xl"
          />

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Perfil do participante
            </p>
            <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
              {profile.nome_completo}
            </h1>
            {profile.badges.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                {profile.badges.map((badgeKey) => {
                  const badge = RANKING_BADGES[badgeKey];

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
                {profile.pontos}
              </span>
              <span className="pb-1 text-xs font-black uppercase tracking-wider text-muted-foreground">
                pontos
              </span>
            </div>
          </div>
        </div>
      </section>

      {!profile.is_current_user && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-4 text-primary">
          <div className="flex gap-3">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">Alguns palpites podem estar ocultos</p>
              <p className="mt-1 text-sm text-primary/80">
                Para proteger o bolão, palpites de jogos que ainda não ficaram ao vivo aparecem
                apenas para quem fez o palpite. Eles são liberados automaticamente durante o ao vivo
                e seguem visíveis depois do encerramento.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mt-5">
        <h2 className="mb-3 font-display text-lg font-black">Desempenho</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {STAT_CARDS.map(({ outcome, label, icon: Icon, className, pointsClassName }) => (
            <div key={outcome} className={cn("rounded-xl border p-3 sm:p-4", className)}>
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-4 w-4" />
                <span
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-wider opacity-80",
                    pointsClassName,
                  )}
                >
                  +{pointsByOutcome[outcome]} pts
                </span>
              </div>
              <div className="mt-4 font-display text-3xl font-black num">
                {profile.estatisticas[outcome]}
              </div>
              <div className="mt-0.5 text-[10px] font-black uppercase tracking-wide">{label}</div>
            </div>
          ))}
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-primary sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                +{profile.especiais.pontos} pts
              </span>
            </div>
            <div className="mt-4 font-display text-3xl font-black num">
              {profile.especiais.acertos}
            </div>
            <div className="mt-0.5 text-[10px] font-black uppercase tracking-wide">Especiais</div>
          </div>
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-black">Todos os palpites</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Jogos encerrados já exibem a pontuação conquistada.
            </p>
          </div>
          <span className="shrink-0 text-xs font-bold text-muted-foreground">
            {filteredGuesses.length} de {profile.palpites.length} jogos
          </span>
        </div>

        <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card/80 p-2 sm:grid-cols-3">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as GuessStatusFilter)}
          >
            <SelectTrigger className="h-10 rounded-lg bg-background/55 font-bold">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              <SelectItem value="finished">Jogos encerrados</SelectItem>
              <SelectItem value="pending">Aguardando jogo</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={outcomeFilter}
            onValueChange={(value) => setOutcomeFilter(value as GuessOutcomeFilter)}
          >
            <SelectTrigger className="h-10 rounded-lg bg-background/55 font-bold">
              <SelectValue placeholder="Pontuação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as pontuações</SelectItem>
              {STAT_CARDS.map((item) => (
                <SelectItem key={item.outcome} value={item.outcome}>
                  {item.label} · {item.points} pts
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={phaseFilter} onValueChange={setPhaseFilter}>
            <SelectTrigger className="h-10 rounded-lg bg-background/55 font-bold">
              <SelectValue placeholder="Fase" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as fases</SelectItem>
              {phases.map((phase) => (
                <SelectItem key={phase} value={phase}>
                  {phase}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredGuesses.length > 0 ? (
          <div className="space-y-10">
            {openGuesses.length > 0 && (
              <div>
                <GuessSectionHeading
                  icon={Clock3}
                  title="Jogos em aberto"
                  description="Jogos em andamento ou que ainda vão acontecer."
                  count={openGuesses.length}
                  className="border-warning/35 bg-warning/10 text-warning"
                />
                <MatchDateGroups
                  items={openGuesses}
                  direction="asc"
                  getKey={(guess) => guess.jogo_id}
                  isLive={(guess) => guess.ao_vivo}
                  renderItem={(guess) => <GuessCard guess={guess} />}
                />
              </div>
            )}
            {finishedGuesses.length > 0 && (
              <div>
                <GuessSectionHeading
                  icon={Check}
                  title="Jogos finalizados"
                  description="Resultados confirmados e pontos conquistados."
                  count={finishedGuesses.length}
                  className="border-success/35 bg-success/10 text-success"
                />
                <MatchDateGroups
                  items={finishedGuesses}
                  direction="desc"
                  getKey={(guess) => guess.jogo_id}
                  renderItem={(guess) => <GuessCard guess={guess} />}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum palpite encontrado com os filtros atuais.
          </div>
        )}
      </section>
    </div>
  );
}

function GuessSectionHeading({
  icon: Icon,
  title,
  description,
  count,
  className,
}: {
  icon: typeof Clock3;
  title: string;
  description: string;
  count: number;
  className: string;
}) {
  return (
    <div className={cn("mb-5 flex items-center gap-3 rounded-xl border p-3 sm:p-4", className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-current/10">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-base font-black text-foreground sm:text-lg">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="shrink-0 rounded-full bg-background/70 px-2.5 py-1 text-xs font-black num">
        {count}
      </span>
    </div>
  );
}

function ProfileState({
  message,
  destructive = false,
}: {
  message: string;
  destructive?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-2xl rounded-2xl border p-8 text-center text-sm",
        destructive
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {message}
    </div>
  );
}

function GuessCard({ guess }: { guess: PerfilPalpite }) {
  const router = useRouter();
  const outcome = guess.outcome ? STAT_CARDS.find((item) => item.outcome === guess.outcome) : null;
  const OutcomeIcon = outcome?.icon;
  const isLive = guess.ao_vivo;

  return (
    <article
      role={isLive ? "link" : undefined}
      tabIndex={isLive ? 0 : undefined}
      aria-label={isLive ? `Acompanhar ${guess.time1} x ${guess.time2} ao vivo` : undefined}
      onClick={() => {
        if (isLive) router.push(`/jogos/${guess.jogo_id}`);
      }}
      onKeyDown={(event) => {
        if (!isLive || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        router.push(`/jogos/${guess.jogo_id}`);
      }}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card/90",
        isLive &&
          "cursor-pointer border-live/60 transition-colors hover:border-live focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(guess.data)}
        </span>
        {isLive ? (
          <span className="flex items-center gap-1 rounded-full bg-live/15 px-2 py-1 text-live">
            <Radio className="h-3.5 w-3.5" />
            Ao vivo
          </span>
        ) : outcome ? (
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
        <Team name={guess.time1} />
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Palpite
          </p>
          <p className="mt-1 whitespace-nowrap font-display text-2xl font-black num">
            {guess.palpite.gols1} <span className="text-muted-foreground">x</span>{" "}
            {guess.palpite.gols2}
          </p>
        </div>
        <Team name={guess.time2} right />
      </div>

      <div className="flex items-center justify-between gap-3 bg-background/45 px-3 py-2.5 text-xs sm:px-4">
        {guess.resultado ? (
          <span className="text-muted-foreground">
            {guess.encerrado ? "Resultado" : "Parcial"}:{" "}
            <strong className="text-foreground num">
              {guess.resultado.gols1} x {guess.resultado.gols2}
            </strong>
          </span>
        ) : (
          <span className="text-muted-foreground">Resultado ainda não disponível</span>
        )}
        <span
          className={cn(
            "font-display text-base font-black num",
            guess.pontos == null
              ? "text-muted-foreground"
              : (outcome?.pointsClassName ?? "text-foreground"),
          )}
        >
          {guess.pontos == null ? "—" : `+${guess.pontos} pts`}
        </span>
      </div>
    </article>
  );
}

function Team({ name, right = false }: { name: string; right?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", right && "flex-row-reverse text-right")}>
      <Flag code={teamCodeFromName(name)} name={name} static />
      <span className="min-w-0 truncate text-xs font-bold sm:text-sm">{name}</span>
    </div>
  );
}

function formatDate(value: string) {
  return formatLocalGameDateTime(value, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
