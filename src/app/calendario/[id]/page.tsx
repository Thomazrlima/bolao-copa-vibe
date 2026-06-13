"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Flame,
  Goal,
  MessageCircle,
  Play,
  Target,
  Trophy,
  Users,
} from "lucide-react";

import { Flag } from "@/components/common/Flag";
import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { teamCodeFromName } from "@/data/iso2";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { getCurrentUsuario, getPalpitesDoJogo, type JogoPalpitesResponse } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { GuessOutcome } from "@/lib/scoring";

type TabValue = "dashboard" | "transmissao";

type ChatMessage = {
  id: string;
  user_id: string | null;
  nome: string;
  texto: string;
  enviado_em: string;
};

const COLORS = ["var(--primary)", "var(--success)", "var(--warning)", "var(--destructive)"];

const resultChartConfig = {
  count: { label: "Palpites" },
} satisfies ChartConfig;

const OUTCOME_CARDS: Array<{
  outcome: GuessOutcome;
  label: string;
  points: number;
  icon: typeof Trophy;
  className: string;
  barClassName: string;
}> = [
  {
    outcome: "chinelada",
    label: "Chinelada",
    points: 10,
    icon: Trophy,
    className: "border-primary/40 bg-primary/10 text-primary",
    barClassName: "bg-primary",
  },
  {
    outcome: "strong",
    label: "Na trave",
    points: 7,
    icon: Flame,
    className: "border-warning/40 bg-warning/10 text-warning",
    barClassName: "bg-warning",
  },
  {
    outcome: "result",
    label: "Só o básico",
    points: 5,
    icon: CheckCircle2,
    className: "border-success/40 bg-success/10 text-success",
    barClassName: "bg-success",
  },
  {
    outcome: "goals",
    label: "Deu sorte",
    points: 2,
    icon: Goal,
    className: "border-border bg-background/55 text-foreground",
    barClassName: "bg-foreground",
  },
  {
    outcome: "miss",
    label: "Sabe nada",
    points: 0,
    icon: CircleHelp,
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    barClassName: "bg-destructive",
  },
];

export default function JogoDetalhePage() {
  const params = useParams<{ id: string }>();
  const jogoId = params.id;
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<JogoPalpitesResponse | null>(null);
  const [tab, setTab] = useState<TabValue>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const load = useCallback(
    async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
      if (showLoading) setLoading(true);
      setError(null);

      try {
        const payload = await getPalpitesDoJogo(jogoId);
        setData(payload);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os detalhes do jogo.",
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [jogoId],
  );

  useEffect(() => {
    load({ showLoading: true });
  }, [load]);

  useEffect(() => {
    let active = true;

    getCurrentUsuario()
      .then((usuario) => {
        if (active) setCurrentUserId(usuario?.id ?? null);
      })
      .catch(() => {
        if (active) setCurrentUserId(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const isLive = useMemo(() => {
    void nowTick;
    return data
      ? data.jogo.placar_status === "live" ||
          (!data.jogo.encerrado && new Date(data.jogo.data).getTime() <= nowAsStoredBrasiliaMs())
      : false;
  }, [data, nowTick]);

  useRealtimeRefresh({
    channelName: `jogo-detalhe-live:${jogoId}`,
    signals: ["jogos", "palpites", "ranking", "transmissoes"],
    onRefresh: load,
  });

  const dashboard = useMemo(() => (data ? buildDashboard(data) : null), [data]);

  if (loading) {
    return <SpinningBallLoader label="Carregando detalhes do jogo" className="min-h-[420px]" />;
  }

  if (error || !data || !dashboard) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6">
        <p className="font-semibold text-destructive">
          {error ?? "Não foi possível carregar os detalhes do jogo."}
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href="/calendario">Voltar ao calendário</Link>
        </Button>
      </div>
    );
  }

  const { jogo } = data;
  const videoTabLabel = getVideoTabLabel(jogo, isLive);
  const currentUserGuess = currentUserId
    ? data.palpites.find((item) => item.user_id === currentUserId)
    : null;
  const currentUserGuessLabel = currentUserGuess
    ? `${currentUserGuess.palpite.gols1} x ${currentUserGuess.palpite.gols2}`
    : "-";

  return (
    <>
      <div className="mb-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
          <Link href="/calendario">
            <ArrowLeft className="h-4 w-4" />
            Calendário
          </Link>
        </Button>

        <header className="overflow-hidden rounded-2xl border border-primary/30 bg-card">
          <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                {formatDateTime(jogo.data)}
              </p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <TeamTitle name={jogo.time1} />
                <ScoreBox
                  gols1={jogo.gols1}
                  gols2={jogo.gols2}
                  encerrado={jogo.encerrado}
                  live={isLive}
                />
                <TeamTitle name={jogo.time2} align="right" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[340px]">
              <KpiCard icon={Users} label="Palpites" value={dashboard.totalPalpites} />
              <KpiCard icon={Target} label="Seu palpite" value={currentUserGuessLabel} />
              <KpiCard
                icon={BarChart3}
                label="Pontuação média"
                value={formatAveragePoints(dashboard.averagePoints)}
              />
            </div>
          </div>
        </header>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-border bg-card/80 p-1 sm:w-fit sm:min-w-[360px]">
          <TabsTrigger
            value="dashboard"
            className="relative gap-1.5 py-2.5 data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            {tab === "dashboard" && (
              <motion.span
                layoutId="game-detail-tab"
                className="absolute inset-0 rounded-md bg-primary"
                transition={{
                  duration: reduceMotion ? 0 : 0.18,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            )}
            <BarChart3 className="relative z-10 h-4 w-4" />
            <span className="relative z-10">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger
            value="transmissao"
            className="relative gap-1.5 py-2.5 data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            {tab === "transmissao" && (
              <motion.span
                layoutId="game-detail-tab"
                className="absolute inset-0 rounded-md bg-primary"
                transition={{
                  duration: reduceMotion ? 0 : 0.18,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            )}
            <Play className="relative z-10 h-4 w-4" />
            <span className="relative z-10">{videoTabLabel}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab data={dashboard} />
        </TabsContent>

        <TabsContent value="transmissao" className="mt-6">
          <TransmissaoTab
            data={data}
            isActive={tab === "transmissao"}
            isLive={isLive}
            label={videoTabLabel}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function DashboardTab({ data }: { data: ReturnType<typeof buildDashboard> }) {
  if (data.finished) {
    return <FinishedDashboardTab data={data} />;
  }

  return <OpenGameDashboardTab data={data} />;
}

function ScoreTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const count = Number(payload[0]?.value ?? 0);

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-xl">
      <p className="num font-display text-lg font-black">{label}</p>
      <p className="mt-1 text-sm font-semibold text-primary">
        {count} {count === 1 ? "palpite" : "palpites"}
      </p>
    </div>
  );
}

function OpenGameDashboardTab({ data }: { data: ReturnType<typeof buildDashboard> }) {
  const [hoveredScore, setHoveredScore] = useState<string | null>(null);
  const rows = hoveredScore
    ? data.rows.filter((row) => `${row.palpite.gols1} x ${row.palpite.gols2}` === hoveredScore)
    : data.rows;

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 font-display text-lg font-black">Distribuição dos palpites</h3>
        <div
          className="h-[280px] min-w-0 max-w-full overflow-hidden"
          onMouseLeave={() => setHoveredScore(null)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.scoreBars} margin={{ left: -18, right: 8, top: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="score" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip
                cursor={{ fill: "color-mix(in oklab, var(--primary) 12%, transparent)" }}
                content={<ScoreTooltip />}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]}>
                {data.scoreBars.map((item) => (
                  <Cell
                    key={item.score}
                    fill={
                      hoveredScore && hoveredScore !== item.score
                        ? "color-mix(in oklab, var(--primary) 24%, transparent)"
                        : "var(--primary)"
                    }
                    onMouseEnter={() =>
                      setHoveredScore((current) => (current === item.score ? current : item.score))
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 font-display text-lg font-black">Resultado previsto</h3>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center lg:block">
          <ChartContainer config={resultChartConfig} className="mx-auto h-[210px] max-w-[300px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={data.resultPie}
                dataKey="count"
                nameKey="label"
                innerRadius={58}
                outerRadius={94}
                paddingAngle={3}
              >
                {data.resultPie.map((item, index) => (
                  <Cell key={item.label} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-1 lg:grid-cols-3">
            {data.resultPie.map((item, index) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/45 p-2"
              >
                <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                <p className="num font-display text-lg font-black">{item.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 lg:col-span-2">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="font-display text-lg font-black">Todos os palpites</h3>
          {hoveredScore ? (
            <span className="num text-xs font-bold text-primary">
              Filtrando placar {hoveredScore} ({rows.length})
            </span>
          ) : null}
        </div>
        {rows.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <Link
                key={row.user_id}
                href={`/perfil/${row.user_id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-background/45 p-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <UserAvatar
                    name={row.nome_completo}
                    avatarPath={row.avatar_url}
                    className="h-8 w-8 bg-primary/15"
                    fallbackClassName="bg-primary/15 text-xs font-black text-primary"
                  />
                  <span className="truncate text-sm font-semibold">{row.nome_completo}</span>
                </span>
                <span className="num font-display text-lg font-black">
                  {row.palpite.gols1} x {row.palpite.gols2}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum palpite registrado para este jogo.</p>
        )}
      </section>
    </div>
  );
}

function FinishedDashboardTab({ data }: { data: ReturnType<typeof buildDashboard> }) {
  const [hoveredOutcome, setHoveredOutcome] = useState<GuessOutcome | null>(null);
  const rows = hoveredOutcome
    ? data.rows.filter((row) => (row.outcome ?? "miss") === hoveredOutcome)
    : data.rows;

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-primary/30 bg-card p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
              Jogo encerrado
            </p>
            <h3 className="font-display text-lg font-black">Distribuição da pontuação</h3>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {data.scoredUsers} de {data.totalPalpites} pontuaram
          </span>
        </div>

        <div
          className="grid gap-2 sm:grid-cols-5 xl:grid-cols-1"
          onMouseLeave={() => setHoveredOutcome(null)}
        >
          {data.outcomeCards.map((item) => {
            const meta = OUTCOME_CARDS.find((card) => card.outcome === item.outcome)!;
            const Icon = meta.icon;

            return (
              <article
                key={item.outcome}
                onMouseEnter={() =>
                  setHoveredOutcome((current) =>
                    current === item.outcome ? current : item.outcome,
                  )
                }
                className={cn(
                  "rounded-xl border p-3 transition-opacity",
                  meta.className,
                  hoveredOutcome && hoveredOutcome !== item.outcome && "opacity-45",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate text-[10px] font-black uppercase tracking-wide">
                      {meta.label}
                    </span>
                  </span>
                  <span className="num shrink-0 text-xs font-black">+{meta.points} pts</span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <span className="num font-display text-3xl font-black">{item.count}</span>
                  <span className="text-[10px] font-bold uppercase text-current/75">
                    {item.percent}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/65">
                  <div
                    className={cn("h-full rounded-full", meta.barClassName)}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-black">Placares mais apostados</h3>
            <p className="text-xs text-muted-foreground">
              Compare a sabedoria coletiva com o placar final do jogo.
            </p>
          </div>
          {data.actualScore ? (
            <span className="num rounded-full bg-primary/15 px-2 py-1 text-xs font-black text-primary">
              Final {data.actualScore}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/45 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Cravaram o placar
            </p>
            <p className="num mt-2 font-display text-3xl font-black text-primary">
              {data.exactScoreHits}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/45 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Pontos distribuídos
            </p>
            <p className="num mt-2 font-display text-3xl font-black">
              {data.totalPoints}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {data.scoreBars.slice(0, 6).map((item) => {
            const percent = data.totalPalpites
              ? Math.round((item.count / data.totalPalpites) * 100)
              : 0;
            const isActual = item.score === data.actualScore;

            return (
              <div
                key={item.score}
                className={cn(
                  "rounded-lg border p-3",
                  isActual
                    ? "border-primary/45 bg-primary/10"
                    : "border-border bg-background/45",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="num font-display text-lg font-black">{item.score}</span>
                    {isActual ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black uppercase text-primary-foreground">
                        placar final
                      </span>
                    ) : null}
                  </span>
                  <span className="num shrink-0 text-sm font-black">
                    {item.count} ({percent}%)
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", isActual ? "bg-primary" : "bg-muted-foreground")}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 xl:col-span-2">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="font-display text-lg font-black">Palpites e pontos</h3>
          {hoveredOutcome ? (
            <span className="text-xs font-bold text-primary">
              Filtrando {getOutcomeLabel(hoveredOutcome)} ({rows.length})
            </span>
          ) : null}
        </div>
        {rows.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => {
              const meta =
                OUTCOME_CARDS.find((item) => item.outcome === row.outcome) ??
                OUTCOME_CARDS.find((item) => item.outcome === "miss")!;
              const Icon = meta.icon;

              return (
                <Link
                  key={row.user_id}
                  href={`/perfil/${row.user_id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-background/45 p-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <UserAvatar
                      name={row.nome_completo}
                      avatarPath={row.avatar_url}
                      className="h-8 w-8 bg-primary/15"
                      fallbackClassName="bg-primary/15 text-xs font-black text-primary"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {row.nome_completo}
                      </span>
                      <span className="num text-xs text-muted-foreground">
                        {row.palpite.gols1} x {row.palpite.gols2}
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-black",
                      meta.className,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="num">+{row.pontos ?? 0}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum palpite registrado para este jogo.</p>
        )}
      </section>
    </div>
  );
}

function TransmissaoTab({
  data,
  isActive,
  isLive,
  label,
}: {
  data: JogoPalpitesResponse;
  isActive: boolean;
  isLive: boolean;
  label: string;
}) {
  const youtubeUrl = normalizeYoutubeUrl(data.jogo.transmissao_url);
  const thumbnailUrl = youtubeUrl ? getYoutubeThumbnailUrl(youtubeUrl) : null;

  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-lg font-black">{label}</h3>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider",
              isLive ? "bg-live/15 text-live" : "bg-muted text-muted-foreground",
            )}
          >
            {isLive ? "ao vivo" : "fora do ar"}
          </span>
        </div>
        {youtubeUrl ? (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noreferrer"
            className="group relative block aspect-video overflow-hidden bg-background"
            aria-label={`Abrir ${label.toLowerCase()} de ${data.jogo.time1} x ${data.jogo.time2} no YouTube`}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={`Thumbnail de ${label.toLowerCase()} de ${data.jogo.time1} x ${data.jogo.time2}`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="grid h-full place-items-center bg-background/60 p-8 text-center">
                <div>
                  <Play className="mx-auto mb-3 h-10 w-10 text-primary" />
                  <p className="font-semibold">Abrir {label.toLowerCase()} no YouTube</p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/20" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-primary-foreground shadow-lg">
                <Play className="h-5 w-5 fill-current" />
                Assistir no YouTube
                <ExternalLink className="h-4 w-4" />
              </span>
            </div>
          </a>
        ) : (
          <div className="grid aspect-video place-items-center bg-background/60 p-8 text-center">
            <div>
              <Play className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">Link de {label.toLowerCase()} ainda não cadastrado.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Preencha `transmissao_url` em `public.jogos` para exibir a thumb do YouTube.
              </p>
            </div>
          </div>
        )}
      </section>

      <ChatPanel jogoId={data.jogo.id} isActive={isActive} />
    </div>
  );
}

function getVideoTabLabel(jogo: JogoPalpitesResponse["jogo"], isLive: boolean) {
  const hasScore = jogo.gols1 != null && jogo.gols2 != null;
  const isFinished = jogo.encerrado || jogo.placar_status === "finished" || (!isLive && hasScore);
  return isFinished ? "Melhores momentos" : "Transmissão";
}

function getOutcomeLabel(outcome: GuessOutcome) {
  return OUTCOME_CARDS.find((item) => item.outcome === outcome)?.label ?? outcome;
}

function ChatPanel({ jogoId, isActive }: { jogoId: string; isActive: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [usuario, setUsuario] = useState<{ id: string; nome_completo: string } | null>(null);
  const [channel, setChannel] = useState<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentUsuario()
      .then((user) => {
        if (active) setUsuario(user ? { id: user.id, nome_completo: user.nome_completo } : null);
      })
      .catch(() => {
        if (active) setUsuario(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const supabase = createClient();
    const nextChannel = supabase.channel(`jogo-chat:${jogoId}`, {
      config: { broadcast: { self: true } },
    });

    nextChannel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        setMessages((current) => [...current.slice(-79), payload as ChatMessage]);
      })
      .subscribe();

    setChannel(nextChannel);

    return () => {
      setChannel(null);
      supabase.removeChannel(nextChannel);
    };
  }, [isActive, jogoId]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text || !channel) return;

    const payload: ChatMessage = {
      id: crypto.randomUUID(),
      user_id: usuario?.id ?? null,
      nome: usuario?.nome_completo ?? "Visitante",
      texto: text.slice(0, 280),
      enviado_em: new Date().toISOString(),
    };

    setMessage("");
    await channel.send({ type: "broadcast", event: "message", payload });
  }

  return (
    <aside className="flex h-[420px] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card lg:h-[clamp(420px,45vw,650px)] lg:self-stretch">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-display text-lg font-black">Chat interno</h3>
        <p className="text-xs text-muted-foreground">
          Conversa interna do bolão, separada do chat do YouTube.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
        {messages.length ? (
          messages.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-background/45 p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-bold">{item.nome}</span>
                <span className="num shrink-0 text-[10px] text-muted-foreground">
                  {formatTime(item.enviado_em)}
                </span>
              </div>
              <p className="break-words text-sm">{item.texto}</p>
            </div>
          ))
        ) : (
          <div className="grid h-full min-h-[220px] place-items-center text-center text-sm text-muted-foreground">
            <div>
              <MessageCircle className="mx-auto mb-2 h-8 w-8" />
              Nenhuma mensagem ainda.
            </div>
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 border-t border-border p-3">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={280}
          disabled={!channel}
          placeholder={channel ? "Escreva uma mensagem..." : "Abrindo chat interno..."}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
        />
        <Button type="submit" disabled={!message.trim() || !channel}>
          Enviar
        </Button>
      </form>
    </aside>
  );
}

function TeamTitle({ name, align = "left" }: { name: string; align?: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", align === "right" && "items-end text-right")}>
      <Flag code={teamCodeFromName(name)} name={name} size="xl" static />
      <h1 className="line-clamp-2 font-display text-xl font-black leading-tight sm:text-3xl">
        {name}
      </h1>
    </div>
  );
}

function ScoreBox({
  gols1,
  gols2,
  encerrado,
  live,
}: {
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
  live: boolean;
}) {
  return (
    <div className="text-center">
      {gols1 != null && gols2 != null ? (
        <div
          className={cn(
            "num rounded-xl border px-4 py-2 font-display text-3xl font-black sm:text-5xl",
            live ? "border-live/50 bg-live/10 text-live" : "border-border bg-background/50",
          )}
        >
          {gols1} <span className="text-muted-foreground">x</span> {gols2}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background/50 px-5 py-3 font-display text-xl font-black text-muted-foreground">
          VS
        </div>
      )}
      <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {encerrado ? "Encerrado" : live ? "Ao vivo" : "Agendado"}
      </p>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/55 p-3">
      <Icon className="mb-2 h-4 w-4 text-primary" />
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="num mt-1 truncate font-display text-xl font-black">{value}</p>
    </div>
  );
}

function buildDashboard(data: JogoPalpitesResponse) {
  const scoreCount = new Map<string, number>();
  const resultCount = new Map<string, number>([
    [data.jogo.time1, 0],
    ["Empate", 0],
    [data.jogo.time2, 0],
  ]);
  const outcomeCount = new Map<GuessOutcome, number>(
    OUTCOME_CARDS.map((item) => [item.outcome, 0]),
  );
  let totalPoints = 0;

  data.palpites.forEach((item) => {
    const score = `${item.palpite.gols1} x ${item.palpite.gols2}`;
    scoreCount.set(score, (scoreCount.get(score) ?? 0) + 1);

    const result =
      item.palpite.gols1 > item.palpite.gols2
        ? data.jogo.time1
        : item.palpite.gols1 < item.palpite.gols2
          ? data.jogo.time2
          : "Empate";
    resultCount.set(result, (resultCount.get(result) ?? 0) + 1);

    const outcome = item.outcome ?? "miss";
    outcomeCount.set(outcome, (outcomeCount.get(outcome) ?? 0) + 1);
    totalPoints += item.pontos ?? 0;
  });

  const scoreBars = [...scoreCount.entries()]
    .map(([score, count]) => ({ score, count }))
    .sort((a, b) => b.count - a.count || a.score.localeCompare(b.score))
    .slice(0, 12);
  const mostPopularScore = scoreBars[0]?.score ?? "-";
  const actualScore =
    data.jogo.gols1 != null && data.jogo.gols2 != null
      ? `${data.jogo.gols1} x ${data.jogo.gols2}`
      : null;
  const exactScoreHits = actualScore ? (scoreCount.get(actualScore) ?? 0) : 0;
  const outcomeCards = OUTCOME_CARDS.map((item) => {
    const count = outcomeCount.get(item.outcome) ?? 0;
    return {
      outcome: item.outcome,
      count,
      percent: data.palpites.length ? Math.round((count / data.palpites.length) * 100) : 0,
    };
  });

  return {
    finished: data.jogo.encerrado,
    totalPalpites: data.palpites.length,
    mostPopularScore,
    actualScore,
    exactScoreHits,
    totalPoints,
    chineladas: data.palpites.filter((item) => item.chinelada).length,
    scoredUsers: data.palpites.filter((item) => (item.pontos ?? 0) > 0).length,
    averagePoints: data.palpites.length ? totalPoints / data.palpites.length : 0,
    scoreBars,
    resultPie: [...resultCount.entries()].map(([label, count]) => ({ label, count })),
    outcomeCards,
    rows: data.jogo.encerrado
      ? [...data.palpites].sort(
          (a, b) =>
            (b.pontos ?? 0) - (a.pontos ?? 0) || a.nome_completo.localeCompare(b.nome_completo),
        )
      : data.palpites,
  };
}

function normalizeYoutubeUrl(url: string | null | undefined) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be")
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function getYoutubeThumbnailUrl(url: string) {
  const videoId = getYoutubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

function getYoutubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.replace("/", "") || null;
    if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] || null;
    if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] || null;
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatAveragePoints(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} pts`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nowAsStoredBrasiliaMs() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return Date.parse(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`,
  );
}
