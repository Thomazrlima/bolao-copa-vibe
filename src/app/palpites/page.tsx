"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
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
  ChevronsUpDown,
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
  WandSparkles,
  XCircle,
} from "lucide-react";

import { Flag } from "@/components/common/Flag";
import { BrazilThemedName } from "@/components/common/BrazilThemedName";
import { MatchDateGroups } from "@/components/common/MatchDateGroups";
import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { teamCodeFromName } from "@/data/iso2";
import { UserAvatar } from "@/components/common/UserAvatar";
import {
  CAMPEAO_BOLAO_QUESTION_ID,
  ESPECIAIS,
  ESPECIAIS_DEADLINE_ISO,
  especiaisAreOpen,
} from "@/lib/especiais";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import {
  getRanking,
  getPalpitesDashboard,
  getPalpitesEspeciais,
  savePalpite,
  savePalpiteEspecial,
  type PalpitesDashboardResponse,
  type RankingUsuario,
} from "@/lib/queries";
import type { GuessOutcome } from "@/lib/scoring";
import {
  formatPalpiteTimeRemaining,
  getPalpiteDeadline,
  isMockPalpiteGame,
  nowAsStoredBrasiliaMs,
  PALPITES_UPDATED_EVENT,
  type PalpiteUrgency,
} from "@/lib/palpite-deadlines";
import {
  formatLocalGameDateTime,
  formatLocalDateKey,
  localCalendarDate,
  localDateKey,
  localTodayKey,
} from "@/lib/local-datetime";
import { cn } from "@/lib/utils";

type Score = { home: number | null; away: number | null };
type DashboardGame = PalpitesDashboardResponse["jogos"][number];
type PalpiteFilters = {
  dateFrom: string;
  dateTo: string;
  round: string;
  group: string;
  team: string;
  timing: "all" | "not-started";
};

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

const WORLD_CUP_END_DATE_KEY = "2026-07-19";
const HISTORY_START_DATE_KEY = "2026-06-11";

const EMPTY_PALPITE_FILTERS: PalpiteFilters = {
  dateFrom: "",
  dateTo: "",
  round: "all",
  group: "all",
  team: "all",
  timing: "all",
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
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<PalpitesDashboardResponse | null>(null);
  const [activeSection, setActiveSection] = useState("open");
  const activeSectionIndex = ["open", "specials", "history", "dashboard"].indexOf(activeSection);
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [recentlySaved, setRecentlySaved] = useState<string | null>(null);
  const [specialAnswers, setSpecialAnswers] = useState<Record<string, string>>({});
  const [correctSpecialAnswers, setCorrectSpecialAnswers] = useState<Record<string, string>>({});
  const [savedSpecialIds, setSavedSpecialIds] = useState<Set<string>>(new Set());
  const [savingSpecialId, setSavingSpecialId] = useState<string | null>(null);
  const [recentlySavedSpecialId, setRecentlySavedSpecialId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<RankingUsuario[]>([]);
  const [openFilters, setOpenFilters] = useState<PalpiteFilters>(EMPTY_PALPITE_FILTERS);
  const [historyFilters, setHistoryFilters] = useState<PalpiteFilters>(EMPTY_PALPITE_FILTERS);
  const [now, setNow] = useState(() => nowAsStoredBrasiliaMs());
  const dirtyScoresRef = useRef(new Set<string>());

  const load = useCallback(
    async ({
      showLoading = false,
      preserveDrafts = true,
      includeSpecials = false,
    }: {
      showLoading?: boolean;
      preserveDrafts?: boolean;
      includeSpecials?: boolean;
    } = {}) => {
      if (showLoading) setLoading(true);
      setError(null);

      try {
        const [loaded, specialResponses, ranking] = await Promise.all([
          getPalpitesDashboard(),
          includeSpecials ? getPalpitesEspeciais() : Promise.resolve(null),
          getRanking(),
        ]);
        setData(loaded);
        setParticipants(ranking);
        setScores((current) =>
          Object.fromEntries(
            loaded.jogos.map((game) => {
              const serverScore = game.palpite
                ? { home: game.palpite.gols1, away: game.palpite.gols2 }
                : { home: null, away: null };
              const preserve =
                preserveDrafts && dirtyScoresRef.current.has(game.id) && !game.iniciado;

              return [game.id, preserve ? (current[game.id] ?? serverScore) : serverScore];
            }),
          ),
        );
        if (specialResponses) {
          setSpecialAnswers(
            Object.fromEntries(
              specialResponses.respostas.map((response) => [
                response.pergunta_id,
                response.resposta,
              ]),
            ),
          );
          setSavedSpecialIds(
            new Set(specialResponses.respostas.map((response) => response.pergunta_id)),
          );
          setCorrectSpecialAnswers(
            Object.fromEntries(
              specialResponses.corretas.map((response) => [
                response.pergunta_id,
                response.resposta,
              ]),
            ),
          );
        }
        setUnauthenticated(false);
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Não foi possível carregar os palpites.";
        setError(message);
        setUnauthenticated(message === "Não autenticado.");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load({ showLoading: true, preserveDrafts: false, includeSpecials: true });
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(nowAsStoredBrasiliaMs()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useRealtimeRefresh({
    channelName: "palpites-live",
    signals: ["jogos", "ranking", "palpites"],
    onRefresh: load,
    enabled: !unauthenticated,
  });

  const openGames = useMemo(() => data?.jogos.filter((game) => !game.encerrado) ?? [], [data]);
  const historyGames = useMemo(
    () =>
      data?.jogos
        .filter((game) => game.encerrado && game.palpite)
        .sort((a, b) => b.data.localeCompare(a.data)) ?? [],
    [data],
  );
  const filterOptions = useMemo(() => buildPalpiteFilterOptions(data?.jogos ?? []), [data]);
  const openDateBounds = useMemo(
    () => buildDateBounds(openGames, localTodayKey(), WORLD_CUP_END_DATE_KEY),
    [openGames],
  );
  const historyDateBounds = useMemo(
    () => buildDateBounds(historyGames, HISTORY_START_DATE_KEY, localTodayKey()),
    [historyGames],
  );
  const filteredOpenGames = useMemo(
    () => filterDashboardGames(openGames, openFilters),
    [openFilters, openGames],
  );
  const filteredHistoryGames = useMemo(
    () => filterDashboardGames(historyGames, historyFilters),
    [historyFilters, historyGames],
  );
  const editableGames = openGames.filter((game) => !game.iniciado);
  const completed = editableGames.filter((game) => game.palpite).length;
  const completion = editableGames.length
    ? Math.round((completed / editableGames.length) * 100)
    : 0;

  function updateScore(id: string, side: keyof Score, rawValue: string) {
    const value = rawValue === "" ? null : Math.min(20, Math.max(0, Number(rawValue)));
    dirtyScoresRef.current.add(id);
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
      dirtyScoresRef.current.delete(game.id);
      setRecentlySaved(game.id);
      toast.success(`Palpite salvo para ${game.time1} x ${game.time2}`, {
        description: `${score.home} x ${score.away}`,
      });
      window.dispatchEvent(new Event(PALPITES_UPDATED_EVENT));
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

  async function persistSpecial(questionId: string) {
    const answer = specialAnswers[questionId];
    if (!answer) return;

    setSavingSpecialId(questionId);
    setError(null);

    try {
      await savePalpiteEspecial(questionId, answer);
      setSavedSpecialIds((current) => new Set([...current, questionId]));
      setRecentlySavedSpecialId(questionId);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o palpite especial.",
      );
    } finally {
      setSavingSpecialId(null);
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

      <Tabs value={activeSection} onValueChange={setActiveSection} className="mt-6">
        <TabsList className="relative grid h-auto w-full grid-cols-4 rounded-xl border border-border bg-card/80 p-1 sm:w-fit sm:min-w-[590px]">
          <motion.span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 rounded-md bg-primary"
            style={{ width: "calc((100% - 0.5rem) / 4)" }}
            animate={{ x: `${Math.max(activeSectionIndex, 0) * 100}%` }}
            transition={{
              duration: reduceMotion ? 0 : 0.34,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
          <TabsTrigger
            value="open"
            className="relative gap-1.5 py-2.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none sm:text-sm"
          >
            <CalendarClock className="relative z-10 hidden h-3.5 w-3.5 sm:block" />
            <span className="relative z-10">Abertos</span>
          </TabsTrigger>
          <TabsTrigger
            value="specials"
            className="relative gap-1.5 py-2.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none sm:text-sm"
          >
            <WandSparkles className="relative z-10 hidden h-3.5 w-3.5 sm:block" />
            <span className="relative z-10">Especiais</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="relative gap-1.5 py-2.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none sm:text-sm"
          >
            <CheckCircle2 className="relative z-10 hidden h-3.5 w-3.5 sm:block" />
            <span className="relative z-10">Histórico</span>
          </TabsTrigger>
          <TabsTrigger
            value="dashboard"
            className="relative gap-1.5 py-2.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none sm:text-sm"
          >
            <BarChart3 className="relative z-10 hidden h-3.5 w-3.5 sm:block" />
            <span className="relative z-10">Dashboard</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-6">
          <SectionHeading
            title="Jogos não finalizados"
            description={`${filteredOpenGames.length} de ${openGames.length} jogos exibidos · ${data.resumo.pendentes} palpites ainda precisam da sua atenção`}
          />
          <PalpitesFilters
            filters={openFilters}
            options={filterOptions}
            minDate={openDateBounds.min}
            maxDate={openDateBounds.max}
            onChange={(partial) => setOpenFilters((current) => ({ ...current, ...partial }))}
          />
          {filteredOpenGames.length ? (
            <MatchDateGroups
              items={filteredOpenGames}
              getKey={(game) => game.id}
              isLive={(game) => game.ao_vivo}
              renderItem={(game) => (
                <OpenMatchCard
                  game={game}
                  score={scores[game.id] ?? { home: null, away: null }}
                  saving={savingId === game.id}
                  recentlySaved={recentlySaved === game.id}
                  now={now}
                  onChange={(side, value) => updateScore(game.id, side, value)}
                  onSave={() => persistGuess(game)}
                />
              )}
            />
          ) : (
            <EmptyState
              message={
                openGames.length
                  ? "Nenhum jogo encontrado com os filtros atuais."
                  : "Não há jogos abertos no momento."
              }
            />
          )}
        </TabsContent>

        <TabsContent value="specials" className="mt-6">
          <SpecialsSection
            answers={specialAnswers}
            correctAnswers={correctSpecialAnswers}
            participants={participants}
            savedIds={savedSpecialIds}
            savingId={savingSpecialId}
            recentlySavedId={recentlySavedSpecialId}
            onSelect={(questionId, answer) => {
              setSpecialAnswers((current) => ({ ...current, [questionId]: answer }));
              setRecentlySavedSpecialId(null);
            }}
            onSave={persistSpecial}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <SectionHeading
            title="Palpites anteriores"
            description={`${filteredHistoryGames.length} de ${historyGames.length} palpites exibidos`}
          />
          <PalpitesFilters
            filters={historyFilters}
            options={filterOptions}
            minDate={historyDateBounds.min}
            maxDate={historyDateBounds.max}
            onChange={(partial) => setHistoryFilters((current) => ({ ...current, ...partial }))}
          />
          {filteredHistoryGames.length ? (
            <MatchDateGroups
              items={filteredHistoryGames}
              direction="desc"
              getKey={(game) => game.id}
              renderItem={(game) => <HistoryMatchCard game={game} />}
            />
          ) : (
            <EmptyState
              message={
                historyGames.length
                  ? "Nenhum palpite encontrado com os filtros atuais."
                  : "Você ainda não tem palpites de jogos encerrados."
              }
            />
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          <Dashboard data={data} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function PalpitesFilters({
  filters,
  options,
  minDate,
  maxDate,
  onChange,
}: {
  filters: PalpiteFilters;
  options: { dates: string[]; rounds: number[]; groups: string[]; teams: string[] };
  minDate: string;
  maxDate: string;
  onChange: (partial: Partial<PalpiteFilters>) => void;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const selectedRange: DateRange | undefined = filters.dateFrom
    ? {
        from: localCalendarDate(filters.dateFrom),
        to: filters.dateTo ? localCalendarDate(filters.dateTo) : undefined,
      }
    : undefined;
  const hasDateFilter = Boolean(filters.dateFrom);

  return (
    <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card/70 p-2 sm:grid-cols-2 lg:grid-cols-5">
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-10 justify-start gap-2 rounded-lg border-border bg-background/55 px-3 text-left font-bold"
          >
            <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate">{formatDateRangeFilter(filters)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="!w-fit min-w-0 overflow-hidden rounded-xl p-0">
          <Calendar
            mode="range"
            selected={selectedRange}
            defaultMonth={selectedRange?.from ?? localCalendarDate(minDate)}
            startMonth={localCalendarDate(minDate)}
            endMonth={localCalendarDate(maxDate)}
            disabled={(date) => {
              const key = dateKey(date);
              return key < minDate || key > maxDate;
            }}
            onSelect={(range) => {
              if (!range?.from) {
                onChange({ dateFrom: "", dateTo: "" });
                return;
              }
              onChange({
                dateFrom: dateKey(range.from),
                dateTo: range.to ? dateKey(range.to) : "",
              });
            }}
          />
          {hasDateFilter && (
            <div className="border-t border-border p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  onChange({ dateFrom: "", dateTo: "" });
                  setDateOpen(false);
                }}
              >
                Limpar período
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Select value={filters.round} onValueChange={(round) => onChange({ round })}>
        <SelectTrigger className="h-10 rounded-lg bg-background/55 font-bold">
          <SelectValue placeholder="Todas as rodadas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as rodadas</SelectItem>
          {options.rounds.map((round) => (
            <SelectItem key={round} value={String(round)}>
              Rodada {round}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.group} onValueChange={(group) => onChange({ group })}>
        <SelectTrigger className="h-10 rounded-lg bg-background/55 font-bold">
          <SelectValue placeholder="Todos os grupos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os grupos</SelectItem>
          {options.groups.map((group) => (
            <SelectItem key={group} value={group}>
              Grupo {group}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.team} onValueChange={(team) => onChange({ team })}>
        <SelectTrigger className="h-10 rounded-lg bg-background/55 font-bold">
          <SelectValue placeholder="Todos os times" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os times</SelectItem>
          {options.teams.map((team) => (
            <SelectItem key={team} value={team}>
              {team}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.timing}
        onValueChange={(timing) => onChange({ timing: timing as PalpiteFilters["timing"] })}
      >
        <SelectTrigger className="h-10 rounded-lg bg-background/55 font-bold">
          <SelectValue placeholder="Todos os jogos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os jogos</SelectItem>
          <SelectItem value="not-started">Não iniciados</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function SpecialsSection({
  answers,
  correctAnswers,
  participants,
  savedIds,
  savingId,
  recentlySavedId,
  onSelect,
  onSave,
}: {
  answers: Record<string, string>;
  correctAnswers: Record<string, string>;
  participants: RankingUsuario[];
  savedIds: Set<string>;
  savingId: string | null;
  recentlySavedId: string | null;
  onSelect: (questionId: string, answer: string) => void;
  onSave: (questionId: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const championQuestion = ESPECIAIS.find((question) => question.id === CAMPEAO_BOLAO_QUESTION_ID);
  const regularQuestions = ESPECIAIS.filter(
    (question) => question.id !== CAMPEAO_BOLAO_QUESTION_ID,
  );
  const answered = ESPECIAIS.filter((question) => savedIds.has(question.id)).length;
  const completion = Math.round((answered / ESPECIAIS.length) * 100);
  const open = especiaisAreOpen(now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      <div className="mb-5 overflow-hidden rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/14 via-card to-card p-4 ring-yellow sm:p-5">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-center">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <WandSparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                Vale visão de futuro
              </p>
              <h3 className="mt-1 font-display text-xl font-black">Palpites especiais</h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {open
                  ? "Escolhas disponíveis até 13/06/2026 às 16:00, horário de Brasília."
                  : "O prazo para responder aos especiais foi encerrado."}
              </p>
            </div>
          </div>
          <div>
            <SpecialsCountdown now={now} />
            <div className="mb-2 flex items-center justify-between text-xs font-bold">
              <span>{answered} respondidos</span>
              <span className="num text-primary">{completion}%</span>
            </div>
            <Progress value={completion} className="h-3" />
          </div>
        </div>
      </div>

      {championQuestion && (
        <article
          className={cn(
            "overflow-hidden rounded-xl border border-primary/40 bg-primary/10 shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition-colors",
            !open && "opacity-75",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-primary/25 bg-primary/15 px-4 py-3">
            <div className="min-w-0">
              <span className="text-[0.65rem] font-black uppercase text-primary">Destaque</span>
              <h4 className="mt-1 font-display text-xl font-black">{championQuestion.question}</h4>
            </div>
            {savedIds.has(championQuestion.id) && (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            )}
          </div>

          <div className="p-4">
            <ParticipantCombobox
              value={answers[championQuestion.id] ?? ""}
              participants={participants}
              disabled={!open}
              onValueChange={(participantId) => onSelect(championQuestion.id, participantId)}
            />

            <SpecialResultSummary
              questionId={championQuestion.id}
              answer={answers[championQuestion.id]}
              correctAnswer={correctAnswers[championQuestion.id]}
              participants={participants}
              className="mt-3 border-primary/20 bg-primary/10"
            />

            <div className="mt-4 flex flex-col gap-3 border-t border-primary/20 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {answers[championQuestion.id]
                  ? `Sua escolha: ${
                      participants.find(
                        (participant) => participant.id === answers[championQuestion.id],
                      )?.nome_completo ?? "Usuário selecionado"
                    }`
                  : "Nenhum usuário selecionado"}
              </span>
              <Button
                type="button"
                size="sm"
                variant={savedIds.has(championQuestion.id) ? "secondary" : "default"}
                disabled={
                  !open || !answers[championQuestion.id] || savingId === championQuestion.id
                }
                onClick={() => onSave(championQuestion.id)}
                className="shrink-0 gap-1.5"
              >
                {!open ? (
                  <>
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Encerrado
                  </>
                ) : recentlySavedId === championQuestion.id ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Salvo
                  </>
                ) : savedIds.has(championQuestion.id) ? (
                  <>
                    <Pencil className="h-3.5 w-3.5" />
                    {savingId === championQuestion.id ? "Atualizando..." : "Atualizar"}
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    {savingId === championQuestion.id ? "Salvando..." : "Salvar"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </article>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {regularQuestions.map((question, index) => {
          const answer = answers[question.id];
          const saved = savedIds.has(question.id);
          const saving = savingId === question.id;
          const recentlySaved = recentlySavedId === question.id;

          return (
            <article
              key={question.id}
              className={cn(
                "overflow-hidden rounded-xl border bg-card transition-colors",
                !open && "opacity-75",
                saved ? "border-primary/35" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start gap-3 border-b border-border bg-background/35 px-4 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/12 font-display text-xs font-black text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-black leading-snug sm:text-base">
                    {question.question}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {open ? "Escolha uma opção" : "Respostas encerradas"}
                  </p>
                </div>
                {saved && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
              </div>

              <div className="p-4">
                <Select
                  value={answer ?? ""}
                  onValueChange={(option) => onSelect(question.id, option)}
                  disabled={!open}
                >
                  <SelectTrigger className="h-11 rounded-xl border-border bg-background/55 font-bold">
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent>
                    {question.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <SpecialResultSummary
                  questionId={question.id}
                  answer={answer}
                  correctAnswer={correctAnswers[question.id]}
                  participants={participants}
                  className="mt-3"
                />

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {answer ? `Sua escolha: ${answer}` : "Nenhuma opção selecionada"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={saved ? "secondary" : "default"}
                    disabled={!open || !answer || saving}
                    onClick={() => onSave(question.id)}
                    className="shrink-0 gap-1.5"
                  >
                    {!open ? (
                      <>
                        <LockKeyhole className="h-3.5 w-3.5" />
                        Encerrado
                      </>
                    ) : recentlySaved ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Salvo
                      </>
                    ) : saved ? (
                      <>
                        <Pencil className="h-3.5 w-3.5" />
                        {saving ? "Atualizando..." : "Atualizar"}
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        {saving ? "Salvando..." : "Salvar"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function SpecialResultSummary({
  questionId,
  answer,
  correctAnswer,
  participants,
  className,
}: {
  questionId: string;
  answer?: string;
  correctAnswer?: string;
  participants: RankingUsuario[];
  className?: string;
}) {
  if (!correctAnswer) return null;

  const correct = answer ? answer === correctAnswer : null;
  const resultLabel = formatSpecialResultAnswer(questionId, correctAnswer, participants);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background/45 px-3 py-2.5 text-xs",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 text-muted-foreground">
          Resultado: <strong className="text-foreground">{resultLabel}</strong>
        </span>
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider",
            correct === true && "border-success/35 bg-success/10 text-success",
            correct === false && "border-destructive/35 bg-destructive/10 text-destructive",
            correct === null && "border-border bg-secondary text-muted-foreground",
          )}
        >
          {correct === true ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Você acertou
            </>
          ) : correct === false ? (
            <>
              <XCircle className="h-3 w-3" />
              Você errou
            </>
          ) : (
            "Sem palpite"
          )}
        </span>
      </div>
    </div>
  );
}

function formatSpecialResultAnswer(
  questionId: string,
  answer: string,
  participants: RankingUsuario[],
) {
  if (questionId !== CAMPEAO_BOLAO_QUESTION_ID) return answer;
  return (
    participants.find((participant) => participant.id === answer)?.nome_completo ?? "Participante"
  );
}

function ParticipantCombobox({
  value,
  participants,
  disabled,
  onValueChange,
}: {
  value: string;
  participants: RankingUsuario[];
  disabled: boolean;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = participants.find((participant) => participant.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || participants.length === 0}
          className="h-12 w-full justify-between rounded-xl border-primary/35 bg-background/75 px-3 text-left font-bold"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected && (
              <UserAvatar
                name={selected.nome_completo}
                avatarPath={selected.avatar_url}
                className="h-7 w-7"
                fallbackClassName="bg-primary/15 text-[10px] font-black text-primary"
              />
            )}
            <span className="min-w-0 truncate">
              {selected ? (
                <BrazilThemedName>{selected.nome_completo}</BrazilThemedName>
              ) : (
                "Selecione um usuário"
              )}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[calc(100vw-2rem)] p-0 sm:w-[640px]">
        <Command>
          <CommandInput placeholder="Buscar usuário..." />
          <CommandList>
            <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
            <CommandGroup>
              {participants.map((participant) => (
                <CommandItem
                  key={participant.id}
                  value={`${participant.nome_completo} ${participant.id}`}
                  onSelect={() => {
                    onValueChange(participant.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      participant.id === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <UserAvatar
                    name={participant.nome_completo}
                    avatarPath={participant.avatar_url}
                    className="h-7 w-7"
                    fallbackClassName="bg-primary/15 text-[10px] font-black text-primary"
                  />
                  <BrazilThemedName className="min-w-0 truncate">
                    {participant.nome_completo}
                  </BrazilThemedName>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SpecialsCountdown({ now }: { now: number }) {
  const remaining = Math.max(0, new Date(ESPECIAIS_DEADLINE_ISO).getTime() - now);
  const closed = remaining === 0;
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return (
    <div
      className={cn(
        "mb-3 rounded-xl border px-3 py-2.5",
        closed ? "border-destructive/40 bg-destructive/10" : "border-primary/35 bg-background/55",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {closed ? <LockKeyhole className="h-3 w-3" /> : <Clock3 className="h-3 w-3 text-primary" />}
        {closed ? "Prazo encerrado" : "Tempo restante"}
      </div>
      {!closed && (
        <div className="num font-display text-xl font-black text-primary">
          {days > 0 && `${days}d `}
          {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
          {String(seconds).padStart(2, "0")}
        </div>
      )}
    </div>
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
  now,
  onChange,
  onSave,
}: {
  game: DashboardGame;
  score: Score;
  saving: boolean;
  recentlySaved: boolean;
  now: number;
  onChange: (side: keyof Score, value: string) => void;
  onSave: () => void;
}) {
  const router = useRouter();
  const complete = score.home != null && score.away != null;
  const isLive = game.ao_vivo;
  const isMock = isMockPalpiteGame(game.id);
  const deadline = !game.palpite && !game.iniciado ? getPalpiteDeadline(game.data, now) : null;
  const urgencyMeta = deadline ? PALPITE_CARD_URGENCY[deadline.urgency] : null;

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Abrir detalhes de ${game.time1} x ${game.time2}`}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button, input, select, textarea")) return;
        router.push(`/jogos/${game.id}`);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        router.push(`/jogos/${game.id}`);
      }}
      className={cn(
        "cursor-pointer overflow-hidden rounded-xl border bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isLive
          ? "border-live/60 bg-gradient-to-br from-live/[0.1] to-card hover:border-live focus-visible:ring-live"
          : game.iniciado
            ? "border-border opacity-80"
            : urgencyMeta
              ? urgencyMeta.card
              : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background/35 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {phaseLabel(game)}
          </p>
          <p className="mt-0.5 text-xs font-semibold">{formatDateTime(game.data)}</p>
        </div>
        {urgencyMeta ? (
          <span
            className={cn(
              "rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider",
              urgencyMeta.badge,
            )}
          >
            {urgencyMeta.label}
          </span>
        ) : (
          <StatusBadge status={game.ao_vivo ? "live" : "scheduled"} />
        )}
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
              game.iniciado
                ? "text-muted-foreground"
                : urgencyMeta
                  ? urgencyMeta.text
                  : "text-warning",
            )}
          >
            {game.iniciado ? (
              <LockKeyhole className="h-3.5 w-3.5" />
            ) : (
              <Clock3 className="h-3.5 w-3.5" />
            )}
            {game.iniciado
              ? "Palpite encerrado"
              : deadline
                ? `Fecha em ${formatPalpiteTimeRemaining(deadline.remainingMs)}`
                : deadlineLabel(game.data, now)}
          </div>

          {game.ao_vivo ? (
            <span className="num text-xs font-bold text-live">
              Parcial: {game.gols1 ?? 0} x {game.gols2 ?? 0}
            </span>
          ) : game.iniciado ? (
            <span className="num text-xs font-bold text-muted-foreground">Aguardando início</span>
          ) : isMock ? (
            <span className="rounded-md border border-primary/35 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
              Modo demonstração
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
  const router = useRouter();
  const outcome = game.outcome ?? "miss";
  const meta = OUTCOME_META[outcome];

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Abrir detalhes de ${game.time1} x ${game.time2}`}
      onClick={() => router.push(`/jogos/${game.id}`)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        router.push(`/jogos/${game.id}`);
      }}
      className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
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
        <span className={cn("num text-sm font-black", outcomePointsTextClass(outcome))}>
          +{game.pontos ?? meta.points} pts
        </span>
      </div>
    </article>
  );
}

function outcomePointsTextClass(outcome: GuessOutcome) {
  if (outcome === "miss") return "text-destructive";
  if (outcome === "strong") return "text-warning";
  if (outcome === "result") return "text-success";
  return "text-muted-foreground";
}

function Dashboard({ data }: { data: PalpitesDashboardResponse }) {
  const reduceMotion = useReducedMotion();
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
                "relative cursor-pointer rounded-md px-3 py-2 text-xs font-bold transition-colors",
                view === value
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {view === value && (
                <motion.span
                  layoutId="palpites-dashboard-tab"
                  className="absolute inset-0 rounded-md bg-primary"
                  transition={{
                    duration: reduceMotion ? 0 : 0.34,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              )}
              <span className="relative z-10">{label}</span>
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

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
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
        title="Placares mais palpitados"
        description="Considerando todos os palpites registrados"
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
          <EmptyState message="Ainda não há palpites registrados." />
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

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
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
            className="palpite-score-input num h-11 w-11 px-1 text-center font-display text-lg font-black sm:h-12 sm:w-12"
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
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5">
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
  return <SpinningBallLoader label="Carregando palpites" />;
}

function buildPalpiteFilterOptions(games: DashboardGame[]) {
  return {
    dates: [...new Set(games.map((game) => localDateKey(game.data)))].sort((a, b) =>
      a.localeCompare(b),
    ),
    rounds: [
      ...new Set(
        games
          .map((game) => game.rodada)
          .filter((round): round is number => typeof round === "number"),
      ),
    ].sort((a, b) => a - b),
    groups: [...new Set(games.map((game) => game.grupo).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    ),
    teams: [...new Set(games.flatMap((game) => [game.time1, game.time2]))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    ),
  };
}

function buildDateBounds(games: DashboardGame[], fallbackMin: string, fallbackMax: string) {
  const dates = [...new Set(games.map((game) => localDateKey(game.data)))].sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    min: dates[0] ?? fallbackMin,
    max: dates.at(-1) ?? fallbackMax,
  };
}

function filterDashboardGames(games: DashboardGame[], filters: PalpiteFilters) {
  return games.filter((game) => {
    const gameDate = localDateKey(game.data);
    if (filters.dateFrom && gameDate < filters.dateFrom) return false;
    if (filters.dateTo && gameDate > filters.dateTo) return false;
    if (filters.round !== "all" && String(game.rodada ?? "") !== filters.round) return false;
    if (filters.group !== "all" && game.grupo !== filters.group) return false;
    if (filters.team !== "all" && game.time1 !== filters.team && game.time2 !== filters.team) {
      return false;
    }
    if (filters.timing === "not-started" && game.iniciado) return false;
    return true;
  });
}

function phaseLabel(game: DashboardGame) {
  return [
    game.fase,
    game.grupo ? `Grupo ${game.grupo}` : null,
    game.rodada ? `Rodada ${game.rodada}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatFilterDate(date: string) {
  return formatLocalDateKey(date, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateRangeFilter(filters: PalpiteFilters) {
  if (!filters.dateFrom) return "Todas as datas";
  if (!filters.dateTo || filters.dateFrom === filters.dateTo) {
    return formatFilterDate(filters.dateFrom);
  }
  return `${formatFilterDate(filters.dateFrom)} até ${formatFilterDate(filters.dateTo)}`;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(iso: string) {
  return formatLocalGameDateTime(iso, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PALPITE_CARD_URGENCY: Record<
  PalpiteUrgency,
  { label: string; card: string; badge: string; text: string }
> = {
  reminder: {
    label: "Menos de 24h",
    card: "border-primary/50 bg-gradient-to-br from-primary/[0.08] to-card hover:border-primary",
    badge: "border-primary/40 bg-primary/15 text-primary",
    text: "text-primary",
  },
  attention: {
    label: "Menos de 6h",
    card: "border-warning/55 bg-gradient-to-br from-warning/[0.1] to-card hover:border-warning",
    badge: "border-warning/45 bg-warning/15 text-warning",
    text: "text-warning",
  },
  critical: {
    label: "Menos de 1h",
    card: "border-destructive/65 bg-gradient-to-br from-destructive/[0.12] to-card hover:border-destructive",
    badge: "border-destructive/50 bg-destructive/15 text-destructive",
    text: "text-destructive",
  },
  imminent: {
    label: "Últimos 10min",
    card: "border-destructive bg-gradient-to-br from-destructive/[0.2] to-card shadow-[0_0_30px_color-mix(in_oklab,var(--destructive)_18%,transparent)] hover:border-destructive",
    badge: "animate-pulse border-destructive bg-destructive text-destructive-foreground",
    text: "text-destructive",
  },
};

function deadlineLabel(iso: string, now = nowAsStoredBrasiliaMs()) {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "Palpite encerrado";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 24) return `Fecha em ${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `Fecha em ${hours}h ${minutes}min`;
}
