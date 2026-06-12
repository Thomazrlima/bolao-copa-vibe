"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  LogIn,
  Pencil,
  Save,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

import { Flag } from "@/components/common/Flag";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { teamCodeFromName } from "@/data/iso2";
import { getPalpitesDashboard, savePalpite, type PalpitesDashboardResponse } from "@/lib/queries";
import type { GuessOutcome } from "@/lib/scoring";
import { cn } from "@/lib/utils";

type Score = { home: number | null; away: number | null };
type DashboardGame = PalpitesDashboardResponse["jogos"][number];

const OUTCOME_META: Record<
  GuessOutcome,
  { name: string; points: number; color: string; tone: string }
> = {
  chinelada: {
    name: "Chinelada",
    points: 10,
    color: "var(--primary)",
    tone: "border-primary/45 bg-primary/10 text-primary",
  },
  strong: {
    name: "Na trave",
    points: 7,
    color: "var(--warning)",
    tone: "border-warning/35 bg-warning/10 text-warning",
  },
  result: {
    name: "Só o básico",
    points: 5,
    color: "var(--success)",
    tone: "border-success/35 bg-success/10 text-success",
  },
  goals: {
    name: "Deu sorte",
    points: 2,
    color: "var(--muted-foreground)",
    tone: "border-border bg-secondary text-secondary-foreground",
  },
  miss: {
    name: "Sabe nada",
    points: 0,
    color: "var(--destructive)",
    tone: "border-destructive/35 bg-destructive/10 text-destructive",
  },
};

const accuracyChartConfig = {
  geral: { label: "Geral", color: "var(--muted-foreground)" },
  voce: { label: "Você", color: "var(--primary)" },
} satisfies ChartConfig;

const pointsChartConfig = {
  points: { label: "Pontos", color: "var(--primary)" },
} satisfies ChartConfig;

const outcomeChartConfig = {
  count: { label: "Palpites" },
} satisfies ChartConfig;

export default function PalpitesPage() {
  const [data, setData] = useState<PalpitesDashboardResponse | null>(null);
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [recentlySaved, setRecentlySaved] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const loaded = await getPalpitesDashboard();
      setData(loaded);
      setScores(
        Object.fromEntries(
          loaded.jogos.map((game) => [
            game.id,
            game.palpite
              ? { home: game.palpite.gols1, away: game.palpite.gols2 }
              : { home: null, away: null },
          ]),
        ),
      );
      setUnauthenticated(false);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Não foi possível carregar os palpites.";
      setError(message);
      setUnauthenticated(message === "Não autenticado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const openGames = useMemo(() => data?.jogos.filter((game) => !game.encerrado) ?? [], [data]);
  const historyGames = useMemo(
    () =>
      data?.jogos
        .filter((game) => game.encerrado && game.palpite)
        .sort((a, b) => b.data.localeCompare(a.data)) ?? [],
    [data],
  );
  const editableGames = openGames.filter((game) => !game.iniciado);
  const completed = editableGames.filter((game) => game.palpite).length;
  const completion = editableGames.length
    ? Math.round((completed / editableGames.length) * 100)
    : 0;

  function updateScore(id: string, side: keyof Score, rawValue: string) {
    const value = rawValue === "" ? null : Math.min(20, Math.max(0, Number(rawValue)));
    setScores((current) => ({ ...current, [id]: { ...current[id], [side]: value } }));
    setRecentlySaved(null);
  }

  async function persistGuess(game: DashboardGame) {
    const score = scores[game.id];
    if (score?.home == null || score.away == null) return;

    setSavingId(game.id);
    setError(null);

    try {
      await savePalpite(game.id, { gols1: score.home, gols2: score.away });
      setRecentlySaved(game.id);
      setData((current) =>
        current
          ? {
              ...current,
              jogos: current.jogos.map((item) =>
                item.id === game.id
                  ? { ...item, palpite: { gols1: score.home!, gols2: score.away! } }
                  : item,
              ),
              resumo: {
                ...current.resumo,
                feitos: current.jogos.find((item) => item.id === game.id)?.palpite
                  ? current.resumo.feitos
                  : current.resumo.feitos + 1,
                pendentes: current.jogos.find((item) => item.id === game.id)?.palpite
                  ? current.resumo.pendentes
                  : Math.max(0, current.resumo.pendentes - 1),
              },
            }
          : current,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Não foi possível salvar o palpite.",
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <PageSkeleton />;

  if (unauthenticated) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <LogIn className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-black">Entre para fazer seus palpites</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Seus palpites, histórico e desempenho ficam vinculados ao seu usuário.
        </p>
        <Button asChild className="mt-5">
          <Link href="/login">Fazer login</Link>
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <ErrorBox message={error ?? "Não foi possível carregar seus palpites."} onRetry={load} />
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            Meus palpites
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Preencha antes da bola rolar, acompanhe seus acertos e veja como a galera está
            apostando.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <div className="num font-display text-xl font-black">{completion}%</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Jogos abertos preenchidos
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <SummaryStrip
        completed={data.resumo.feitos}
        pending={data.resumo.pendentes}
        points={data.resumo.pontos}
        position={data.resumo.posicao}
      />

      <Tabs defaultValue="open" className="mt-6">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl border border-border bg-card/80 p-1 sm:w-fit sm:min-w-[440px]">
          <TabsTrigger value="open" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <CalendarClock className="h-3.5 w-3.5" />
            Abertos
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <BarChart3 className="h-3.5 w-3.5" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-6">
          <SectionHeading
            title="Jogos não finalizados"
            description={`${data.resumo.pendentes} palpites ainda precisam da sua atenção`}
          />
          {openGames.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {openGames.map((game) => (
                <OpenMatchCard
                  key={game.id}
                  game={game}
                  score={scores[game.id] ?? { home: null, away: null }}
                  saving={savingId === game.id}
                  recentlySaved={recentlySaved === game.id}
                  onChange={(side, value) => updateScore(game.id, side, value)}
                  onSave={() => persistGuess(game)}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="Não há jogos abertos no momento." />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <SectionHeading
            title="Palpites anteriores"
            description="A classificação segue exatamente a linguagem da página de regras"
          />
          {historyGames.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {historyGames.map((game) => (
                <HistoryMatchCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <EmptyState message="Você ainda não tem palpites de jogos encerrados." />
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          <Dashboard data={data} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function SummaryStrip({
  completed,
  pending,
  points,
  position,
}: {
  completed: number;
  pending: number;
  points: number;
  position: number | null;
}) {
  const items = [
    {
      label: "Palpites feitos",
      value: completed,
      detail: "em jogos abertos",
      icon: CheckCircle2,
      tone: "text-success bg-success/10",
    },
    {
      label: "Pendentes",
      value: pending,
      detail: "antes do prazo",
      icon: Clock3,
      tone: "text-warning bg-warning/10",
    },
    {
      label: "Seus pontos",
      value: points,
      detail: position ? `${position}º lugar geral` : "sem posição",
      icon: Trophy,
      tone: "text-primary bg-primary/10",
    },
  ];

  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-card/75 sm:grid-cols-3">
      {items.map(({ label, value, detail, icon: Icon, tone }, index) => (
        <div
          key={label}
          className={cn(
            "flex items-center gap-3 p-4",
            index > 0 && "border-t border-border sm:border-l sm:border-t-0",
          )}
        >
          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", tone)}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="num font-display text-2xl font-black">{value}</span>
              <span className="truncate text-xs text-muted-foreground">{detail}</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OpenMatchCard({
  game,
  score,
  saving,
  recentlySaved,
  onChange,
  onSave,
}: {
  game: DashboardGame;
  score: Score;
  saving: boolean;
  recentlySaved: boolean;
  onChange: (side: keyof Score, value: string) => void;
  onSave: () => void;
}) {
  const complete = score.home != null && score.away != null;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors",
        game.iniciado ? "border-border opacity-80" : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background/35 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {phaseLabel(game)}
          </p>
          <p className="mt-0.5 text-xs font-semibold">{formatDateTime(game.data)}</p>
        </div>
        <StatusBadge status={game.iniciado ? "live" : "scheduled"} />
      </div>

      <div className="p-4">
        <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <Team name={game.time1} />
          <ScoreInputs score={score} disabled={game.iniciado || saving} onChange={onChange} />
          <Team name={game.time2} align="right" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold",
              game.iniciado ? "text-muted-foreground" : "text-warning",
            )}
          >
            {game.iniciado ? (
              <LockKeyhole className="h-3.5 w-3.5" />
            ) : (
              <Clock3 className="h-3.5 w-3.5" />
            )}
            {game.iniciado ? "Palpite encerrado" : deadlineLabel(game.data)}
          </div>

          {game.iniciado ? (
            <span className="text-xs font-bold text-muted-foreground">
              {game.palpite
                ? `Seu palpite: ${game.palpite.gols1} x ${game.palpite.gols2}`
                : "Você não palpitou"}
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              variant={game.palpite ? "secondary" : "default"}
              disabled={!complete || saving}
              onClick={onSave}
              className="gap-1.5"
            >
              {recentlySaved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Salvo
                </>
              ) : game.palpite ? (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  {saving ? "Atualizando..." : "Atualizar palpite"}
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Salvando..." : "Salvar palpite"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function HistoryMatchCard({ game }: { game: DashboardGame }) {
  const outcome = game.outcome ?? "miss";
  const meta = OUTCOME_META[outcome];

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {phaseLabel(game)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(game.data)}</p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider",
            meta.tone,
          )}
        >
          {meta.name}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Team name={game.time1} />
        <div className="text-center">
          <div className="num font-display text-2xl font-black">
            {game.gols1} <span className="text-muted-foreground">x</span> {game.gols2}
          </div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Placar final
          </div>
        </div>
        <Team name={game.time2} align="right" />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5">
        <span className="text-xs text-muted-foreground">Seu palpite</span>
        <span className="num font-display font-black">
          {game.palpite?.gols1} x {game.palpite?.gols2}
        </span>
        <span
          className={cn(
            "num text-sm font-black",
            game.pontos ? "text-success" : "text-muted-foreground",
          )}
        >
          +{game.pontos ?? meta.points} pts
        </span>
      </div>
    </article>
  );
}

function Dashboard({ data }: { data: PalpitesDashboardResponse }) {
  const [view, setView] = useState<"general" | "mine">("general");

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          title="Dashboard de palpites"
          description="Dados calculados a partir dos palpites registrados"
          className="mb-0"
        />
        <div className="grid grid-cols-2 rounded-lg border border-border bg-card p-1">
          {[
            ["general", "Visão geral"],
            ["mine", "Meu desempenho"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value as "general" | "mine")}
              className={cn(
                "rounded-md px-3 py-2 text-xs font-bold transition-colors",
                view === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "general" ? <GeneralDashboard data={data} /> : <PersonalDashboard data={data} />}
    </>
  );
}

function GeneralDashboard({ data }: { data: PalpitesDashboardResponse }) {
  const chartOutcomes = data.geral.outcomes.map((item) => ({
    ...item,
    name: OUTCOME_META[item.outcome].name,
    fill: OUTCOME_META[item.outcome].color,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Users} label="Participantes" value={data.geral.participantes} />
        <MetricCard icon={Target} label="Palpites feitos" value={data.geral.palpites} />
        <MetricCard icon={Sparkles} label="Chineladas" value={data.geral.chineladas} />
        <MetricCard
          icon={TrendingUp}
          label="Média por palpite"
          value={`${data.geral.media_pontos.toFixed(1)} pts`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <DashboardCard title="Precisão por rodada" description="Acertos gerais comparados aos seus">
          {data.geral.rodadas.length ? (
            <ChartContainer config={accuracyChartConfig} className="h-[260px] w-full">
              <BarChart data={data.geral.rodadas} margin={{ left: -18, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="round" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="geral" fill="var(--color-geral)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="voce" fill="var(--color-voce)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyState message="A precisão aparecerá quando houver jogos encerrados." />
          )}
        </DashboardCard>

        <DashboardCard title="Faixas de pontuação" description="Distribuição pelas regras do bolão">
          {chartOutcomes.some((item) => item.count > 0) ? (
            <>
              <ChartContainer
                config={outcomeChartConfig}
                className="mx-auto h-[210px] max-w-[300px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={chartOutcomes}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                  >
                    {chartOutcomes.map((entry) => (
                      <Cell key={entry.outcome} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <OutcomeLegend outcomes={data.geral.outcomes} />
            </>
          ) : (
            <EmptyState message="Sem palpites pontuados ainda." />
          )}
        </DashboardCard>
      </div>

      <DashboardCard
        title="Placares mais apostados"
        description={
          data.geral.jogo_popular
            ? `${data.geral.jogo_popular.time1} x ${data.geral.jogo_popular.time2}`
            : "Próximo jogo aberto"
        }
      >
        {data.geral.palpites_populares.length ? (
          <div className="space-y-3">
            {data.geral.palpites_populares.map((item, index) => (
              <div key={item.score} className="grid grid-cols-[42px_1fr_64px] items-center gap-3">
                <span className="num font-display text-sm font-black">{item.score}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      index === 0 ? "bg-primary" : "bg-primary/45",
                    )}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                <span className="num text-right text-xs font-bold text-muted-foreground">
                  {item.count} votos
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Ainda não há palpites para o próximo jogo." />
        )}
      </DashboardCard>
    </div>
  );
}

function PersonalDashboard({ data }: { data: PalpitesDashboardResponse }) {
  const accuracy = data.pessoal.encerrados
    ? Math.round((data.pessoal.acertos / data.pessoal.encerrados) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Trophy}
          label="Posição atual"
          value={data.pessoal.posicao ? `${data.pessoal.posicao}º` : "-"}
        />
        <MetricCard icon={Target} label="Chineladas" value={data.pessoal.chineladas} />
        <MetricCard icon={TrendingUp} label="Acertos" value={data.pessoal.acertos} />
        <MetricCard icon={Sparkles} label="Aproveitamento" value={`${accuracy}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <DashboardCard title="Evolução dos seus pontos" description="Pontuação acumulada por jogo">
          {data.pessoal.evolucao.length ? (
            <ChartContainer config={pointsChartConfig} className="h-[260px] w-full">
              <AreaChart data={data.pessoal.evolucao} margin={{ left: -18, right: 8, top: 12 }}>
                <defs>
                  <linearGradient id="pointsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-points)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--color-points)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="game" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="points"
                  stroke="var(--color-points)"
                  strokeWidth={3}
                  fill="url(#pointsGradient)"
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <EmptyState message="Sua evolução aparecerá após o primeiro jogo encerrado." />
          )}
        </DashboardCard>

        <DashboardCard title="Seu raio-x" description="Resultados pelas regras do bolão">
          <div className="space-y-4">
            {data.pessoal.outcomes.map((item) => {
              const percent = data.pessoal.encerrados
                ? Math.round((item.count / data.pessoal.encerrados) * 100)
                : 0;
              return (
                <div key={item.outcome}>
                  <div className="mb-1.5 flex justify-between text-xs font-bold">
                    <span>{OUTCOME_META[item.outcome].name}</span>
                    <span className="num text-primary">{item.count}</span>
                  </div>
                  <Progress value={percent} />
                </div>
              );
            })}
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}

function ScoreInputs({
  score,
  disabled,
  onChange,
}: {
  score: Score;
  disabled?: boolean;
  onChange: (side: keyof Score, value: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {(["home", "away"] as const).map((side, index) => (
        <div key={side} className="contents">
          {index > 0 && <span className="font-display font-black text-muted-foreground">x</span>}
          <Input
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            value={score[side] ?? ""}
            disabled={disabled}
            onChange={(event) => onChange(side, event.target.value)}
            aria-label={side === "home" ? "Gols do time da casa" : "Gols do time visitante"}
            className="num h-11 w-11 px-1 text-center font-display text-lg font-black sm:h-12 sm:w-12"
          />
        </div>
      ))}
    </div>
  );
}

function Team({ name, align = "left" }: { name: string; align?: "left" | "right" }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <Flag code={teamCodeFromName(name)} name={name} size="lg" static />
      <span className="min-w-0 truncate text-xs font-bold sm:text-sm">{name}</span>
    </div>
  );
}

function OutcomeLegend({ outcomes }: { outcomes: PalpitesDashboardResponse["geral"]["outcomes"] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {outcomes.map((item) => (
        <div key={item.outcome} className="flex items-center gap-2 text-xs">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: OUTCOME_META[item.outcome].color }}
          />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {OUTCOME_META[item.outcome].name}
          </span>
          <span className="num font-bold">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <span className="mb-4 grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="num font-display text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-bold">{label}</div>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="font-display text-base font-black">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SectionHeading({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      <h3 className="font-display text-xl font-black tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <span>{message}</span>
      {onRetry && (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-9 w-52 rounded bg-muted" />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-20 rounded-xl border border-border bg-card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-52 rounded-xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}

function phaseLabel(game: DashboardGame) {
  return game.rodada ? `${game.fase} · Rodada ${game.rodada}` : game.fase;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function deadlineLabel(iso: string) {
  const diff = new Date(iso).getTime() - nowAsStoredBrasiliaMs();
  if (diff <= 0) return "Palpite encerrado";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 24) return `Fecha em ${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `Fecha em ${hours}h ${minutes}min`;
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
