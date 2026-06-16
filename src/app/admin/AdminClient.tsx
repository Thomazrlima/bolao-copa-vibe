"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Activity,
  Bug,
  Check,
  CheckCircle2,
  ClockAlert,
  ExternalLink,
  Loader2,
  Radio,
  RefreshCw,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";

import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { BrazilThemedName } from "@/components/common/BrazilThemedName";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canManageUsers } from "@/lib/admin-users";
import { CAMPEAO_BOLAO_QUESTION_ID, ESPECIAIS } from "@/lib/especiais";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { formatLocalDateTime, formatLocalGameDateTime } from "@/lib/local-datetime";
import { createUsuario, getCurrentUsuario, type Usuario } from "@/lib/queries";

type CreatedUser = {
  email: string;
  temporaryPassword: string;
  emailConfirmationRequired: boolean;
};

type BugReport = {
  id: string;
  user_id: string | null;
  nome: string | null;
  email: string;
  pagina: string | null;
  descricao: string;
  passos: string | null;
  esperado: string | null;
  atual: string | null;
  navegador: string | null;
  status: string;
  criado_em: string;
};

type ReportFilter = "open" | "closed";

type AdminGame = {
  id: string;
  fase_id: number;
  time1: string;
  time2: string;
  data: string;
  encerrado: boolean;
  transmissao_url: string | null;
};

type PendingUser = {
  id: string;
  nome_completo: string;
  email: string;
  jogos_pendentes: AdminGame[];
};

type Highlight = {
  slot: number;
  jogo_id: string | null;
  url: string;
};

type SpecialParticipant = {
  id: string;
  nome_completo: string;
};

type SpecialCorrectAnswer = {
  pergunta_id: string;
  resposta: string;
  atualizado_em: string;
};

type AdminOverview = {
  generated_at: string;
  pending_users: PendingUser[];
  urgent_games: AdminGame[];
  games: AdminGame[];
  highlights: Highlight[];
  sync_status: {
    bloqueado_ate: string | null;
    ultima_tentativa: string | null;
    ultimo_sucesso: string | null;
    ultimo_erro: string | null;
    jogos_elegiveis: number;
    jogos_sincronizados: number;
    duracao_ms: number | null;
  } | null;
};

type SyncDiagnostic = {
  jogo_id: string;
  evento_id: string;
  jogo: string;
  tipo: "placar" | "estatisticas" | "selecoes" | "convocados" | "jogadores";
  consultado_em: string;
  interpretado: unknown;
  resposta: unknown;
  erro?: string;
};

type SyncExecution = {
  id: string;
  iniciado_em: string;
  finalizado_em: string | null;
  sucesso: boolean | null;
  erro: string | null;
  duracao_ms: number | null;
  resumo: {
    jogos_elegiveis?: number;
    jogos_sincronizados?: number;
    jogos_encerrados?: number;
    estatisticas_sincronizadas?: number;
    selecoes_processadas?: number;
    jogadores_salvos?: number;
    modo?: "pendentes" | "completo";
  };
  diagnosticos: SyncDiagnostic[];
  legado?: boolean;
};

type PlayersSyncResponse = {
  ok?: boolean;
  selecoes_processadas?: number;
  selecoes_com_erro?: number;
  jogadores_salvos?: number;
  chamadas_api_football?: number;
  modo?: "pendentes" | "completo";
  erros?: Array<{ codigo: string; nome: string; erro: string }>;
  error?: string;
};

export function AdminClient() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>(defaultHighlights);
  const [highlightsSaving, setHighlightsSaving] = useState(false);
  const [highlightsMessage, setHighlightsMessage] = useState<string | null>(null);
  const [specialAnswers, setSpecialAnswers] = useState<Record<string, string>>({});
  const [specialParticipants, setSpecialParticipants] = useState<SpecialParticipant[]>([]);
  const [specialsLoading, setSpecialsLoading] = useState(false);
  const [specialsSaving, setSpecialsSaving] = useState(false);
  const [specialsMessage, setSpecialsMessage] = useState<string | null>(null);
  const [reports, setReports] = useState<BugReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<ReportFilter>("open");
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [userCreating, setUserCreating] = useState(false);
  const [userCreationError, setUserCreationError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [syncExecutions, setSyncExecutions] = useState<SyncExecution[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [playersSyncing, setPlayersSyncing] = useState(false);
  const [playersSyncMessage, setPlayersSyncMessage] = useState<string | null>(null);

  const loadOverview = useCallback(async ({ syncHighlights = true } = {}) => {
    setOverviewLoading(true);
    setOverviewError(null);

    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível carregar os dados administrativos.");
      }

      setOverview(body);
      if (syncHighlights) setHighlights(body.highlights ?? defaultHighlights());
    } catch (error) {
      setOverviewError(
        error instanceof Error ? error.message : "Não foi possível carregar o relatório.",
      );
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);

    try {
      const response = await fetch("/api/admin/bug-reports", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível carregar os bug reports.");
      }

      setReports(body.reports ?? []);
    } catch (error) {
      setReportsError(
        error instanceof Error ? error.message : "Não foi possível carregar reports.",
      );
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const loadSpecialAnswers = useCallback(async () => {
    setSpecialsLoading(true);
    setSpecialsMessage(null);

    try {
      const response = await fetch("/api/admin/especiais", { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as {
        respostas?: SpecialCorrectAnswer[];
        participantes?: SpecialParticipant[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível carregar os especiais.");
      }

      setSpecialParticipants(body.participantes ?? []);
      setSpecialAnswers(
        Object.fromEntries(
          (body.respostas ?? []).map((answer) => [answer.pergunta_id, answer.resposta]),
        ),
      );
    } catch (error) {
      setSpecialsMessage(
        error instanceof Error ? error.message : "Não foi possível carregar os especiais.",
      );
    } finally {
      setSpecialsLoading(false);
    }
  }, []);

  const loadSyncExecutions = useCallback(async () => {
    setSyncLoading(true);
    setSyncError(null);

    try {
      const response = await fetch("/api/admin/sync", { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as {
        executions?: SyncExecution[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível carregar o histórico do sync.");
      }

      setSyncExecutions(body.executions ?? []);
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Não foi possível carregar o histórico do sync.",
      );
    } finally {
      setSyncLoading(false);
    }
  }, []);

  const refreshOverview = useCallback(
    () => loadOverview({ syncHighlights: false }),
    [loadOverview],
  );

  async function handleReportStatus(report: BugReport) {
    const nextStatus = report.status === "resolvido" ? "novo" : "resolvido";
    setUpdatingReportId(report.id);
    setReportsError(null);

    try {
      const response = await fetch("/api/admin/bug-reports", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: report.id, status: nextStatus }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível atualizar o chamado.");
      }

      setReports((current) => current.map((item) => (item.id === report.id ? body.report : item)));
    } catch (error) {
      setReportsError(
        error instanceof Error ? error.message : "Não foi possível atualizar o chamado.",
      );
    } finally {
      setUpdatingReportId(null);
    }
  }

  async function handlePlayersSync() {
    setPlayersSyncing(true);
    setPlayersSyncMessage(null);
    setSyncError(null);

    try {
      const response = await fetch("/api/admin/selecoes/sync", { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as PlayersSyncResponse;

      if (!response.ok && response.status !== 207) {
        throw new Error(body.error ?? "Não foi possível sincronizar jogadores.");
      }

      const errorCount = body.selecoes_com_erro ?? 0;
      const suffix = errorCount
        ? ` ${errorCount} seleção(ões) ficaram com erro.`
        : " Sem erros reportados.";
      const modeLabel = body.modo === "completo" ? "refresh completo" : "pendentes e falhas";
      setPlayersSyncMessage(
        `Sync de ${modeLabel}: ${body.jogadores_salvos ?? 0} jogadores em ${
          body.selecoes_processadas ?? 0
        } seleção(ões). ${body.chamadas_api_football ?? 0} chamada(s) à API-Football.${suffix}`,
      );
      await loadSyncExecutions();
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Não foi possível sincronizar jogadores.",
      );
    } finally {
      setPlayersSyncing(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const currentUser = await getCurrentUsuario();
        if (!active) return;
        setUsuario(currentUser);

        if (currentUser && canManageUsers(currentUser.email)) {
          await Promise.all([
            loadOverview(),
            loadReports(),
            loadSpecialAnswers(),
            loadSyncExecutions(),
          ]);
        }
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Não foi possível carregar a área.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [loadOverview, loadReports, loadSpecialAnswers, loadSyncExecutions]);

  useEffect(() => {
    if (!usuario || !canManageUsers(usuario.email)) return;

    const interval = window.setInterval(() => void loadSyncExecutions(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadSyncExecutions, usuario]);

  const realtimeEnabled = Boolean(usuario && canManageUsers(usuario.email));

  useRealtimeRefresh({
    channelName: "admin-overview-live",
    signals: ["jogos", "grupos", "ranking", "palpites", "transmissoes"],
    onRefresh: refreshOverview,
    enabled: realtimeEnabled,
  });

  useRealtimeRefresh({
    channelName: "admin-bugs-live",
    signals: ["bugs"],
    onRefresh: loadReports,
    enabled: realtimeEnabled,
  });

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserCreating(true);
    setUserCreationError(null);
    setCreatedUser(null);

    try {
      const result = await createUsuario({
        email: newUserEmail.trim(),
        nome_completo: newUserName.trim(),
        telefone: newUserPhone.trim(),
      });

      setCreatedUser({
        email: result.usuario.email,
        temporaryPassword: result.temporary_password,
        emailConfirmationRequired: result.email_confirmation_required,
      });
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPhone("");
      await loadOverview();
    } catch (error) {
      setUserCreationError(
        error instanceof Error ? error.message : "Não foi possível adicionar o usuário.",
      );
    } finally {
      setUserCreating(false);
    }
  }

  async function handleSaveHighlights(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHighlightsSaving(true);
    setHighlightsMessage(null);

    try {
      const response = await fetch("/api/admin/transmissoes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ highlights }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível salvar as transmissões.");
      }

      setHighlightsMessage("Jogos e links atualizados.");
      await loadOverview();
    } catch (error) {
      setHighlightsMessage(
        error instanceof Error ? error.message : "Não foi possível salvar as transmissões.",
      );
    } finally {
      setHighlightsSaving(false);
    }
  }

  async function handleSaveSpecialAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSpecialsSaving(true);
    setSpecialsMessage(null);

    try {
      const response = await fetch("/api/admin/especiais", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          respostas: ESPECIAIS.map((question) => ({
            pergunta_id: question.id,
            resposta: specialAnswers[question.id] || null,
          })),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        respostas?: SpecialCorrectAnswer[];
        ranking?: {
          jogos_recalculados: number;
          usuarios_atualizados: number;
        };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível salvar as respostas corretas.");
      }

      setSpecialAnswers(
        Object.fromEntries(
          (body.respostas ?? []).map((answer) => [answer.pergunta_id, answer.resposta]),
        ),
      );
      setSpecialsMessage(
        `Respostas corretas atualizadas. Ranking recalculado para ${
          body.ranking?.usuarios_atualizados ?? 0
        } participantes.`,
      );
    } catch (error) {
      setSpecialsMessage(
        error instanceof Error ? error.message : "Não foi possível salvar as respostas corretas.",
      );
    } finally {
      setSpecialsSaving(false);
    }
  }

  function updateHighlight(slot: number, field: "jogo_id" | "url", value: string) {
    setHighlights((current) =>
      current.map((highlight) =>
        highlight.slot === slot ? { ...highlight, [field]: value } : highlight,
      ),
    );
    setHighlightsMessage(null);
  }

  function selectHighlightGame(slot: number, jogoId: string) {
    const game = overview?.games.find((item) => item.id === jogoId);

    setHighlights((current) =>
      current.map((highlight) =>
        highlight.slot === slot
          ? { ...highlight, jogo_id: jogoId, url: game?.transmissao_url ?? "" }
          : highlight,
      ),
    );
    setHighlightsMessage(null);
  }

  function updateSpecialAnswer(questionId: string, answer: string) {
    setSpecialAnswers((current) => ({ ...current, [questionId]: answer }));
    setSpecialsMessage(null);
  }

  function clearSpecialAnswer(questionId: string) {
    setSpecialAnswers((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    setSpecialsMessage(null);
  }

  if (loading) {
    return <SpinningBallLoader label="Carregando administração" />;
  }

  if (loadError || !usuario) {
    return (
      <AdminMessage
        title="Acesso indisponível"
        message={loadError ?? "Entre na sua conta para acessar a administração."}
      />
    );
  }

  if (!canManageUsers(usuario.email)) {
    return (
      <AdminMessage
        title="Sem permissão"
        message="Seu usuário não tem acesso à área administrativa."
      />
    );
  }

  const openReports = reports.filter((report) => report.status !== "resolvido");
  const closedReports = reports.filter((report) => report.status === "resolvido");
  const visibleReports = reportFilter === "open" ? openReports : closedReports;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Administração</p>
        <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
          Painel administrativo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe pendências, transmissões, participantes e relatos do site.
        </p>
        <SyncStatus status={overview?.sync_status ?? null} />
      </header>

      <Tabs defaultValue="pending">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-6">
          <TabsTrigger value="pending" className="gap-2">
            <ClockAlert className="h-4 w-4" />
            Pendências
          </TabsTrigger>
          <TabsTrigger value="transmissions" className="gap-2">
            <Radio className="h-4 w-4" />
            Transmissões
          </TabsTrigger>
          <TabsTrigger value="specials" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Especiais
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Participantes
          </TabsTrigger>
          <TabsTrigger value="bugs" className="gap-2">
            <Bug className="h-4 w-4" />
            Bug reports
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <Activity className="h-4 w-4" />
            Sync
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-5">
          <PendingReport
            overview={overview}
            loading={overviewLoading}
            error={overviewError}
            onRefresh={() => void loadOverview()}
          />
        </TabsContent>

        <TabsContent value="transmissions" className="mt-5">
          <form
            onSubmit={handleSaveHighlights}
            className="min-w-0 overflow-hidden rounded-xl border border-primary/30 bg-card p-4 sm:p-6"
          >
            <SectionHeader
              icon={Radio}
              title="Jogos em destaque"
              description="Escolha os dois jogos e edite os links exibidos nas páginas de transmissão e melhores momentos."
            />

            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              {highlights.map((highlight) => (
                <div
                  key={highlight.slot}
                  className="min-w-0 rounded-lg border border-border bg-background/50 p-3 sm:p-4"
                >
                  <p className="mb-4 text-xs font-black uppercase tracking-[0.16em] text-primary">
                    Jogo {highlight.slot}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor={`highlight-game-${highlight.slot}`}>Partida</Label>
                    <Select
                      value={highlight.jogo_id ?? ""}
                      onValueChange={(value) => selectHighlightGame(highlight.slot, value)}
                    >
                      <SelectTrigger id={`highlight-game-${highlight.slot}`} className="min-w-0">
                        <SelectValue placeholder="Selecione um jogo" />
                      </SelectTrigger>
                      <SelectContent className="max-w-[calc(100vw-2rem)]">
                        {(overview?.games ?? []).map((game) => (
                          <SelectItem key={game.id} value={game.id}>
                            {formatGameOption(game)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`highlight-url-${highlight.slot}`}>Link do vídeo</Label>
                    <Input
                      id={`highlight-url-${highlight.slot}`}
                      type="url"
                      value={highlight.url}
                      onChange={(event) =>
                        updateHighlight(highlight.slot, "url", event.target.value)
                      }
                      placeholder="https://www.youtube.com/watch?v=..."
                      required
                      className="min-w-0"
                    />
                  </div>
                </div>
              ))}
            </div>

            {overviewError ? <InlineError message={overviewError} /> : null}
            {highlightsMessage ? (
              <p className="mt-4 rounded-lg border border-border bg-background/50 p-3 text-sm">
                {highlightsMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                disabled={highlightsSaving || overviewLoading}
                className="w-full sm:w-auto"
              >
                {highlightsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {highlightsSaving ? "Salvando..." : "Salvar transmissões"}
              </Button>
              <Button asChild type="button" variant="secondary" className="w-full sm:w-auto">
                <Link href="/transmissao">
                  Visualizar página
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="specials" className="mt-5">
          <SpecialAnswersSection
            answers={specialAnswers}
            participants={specialParticipants}
            loading={specialsLoading}
            saving={specialsSaving}
            message={specialsMessage}
            onRefresh={() => void loadSpecialAnswers()}
            onSave={handleSaveSpecialAnswers}
            onChange={updateSpecialAnswer}
            onClear={clearSpecialAnswer}
          />
        </TabsContent>

        <TabsContent value="users" className="mt-5">
          <form
            onSubmit={handleCreateUser}
            className="rounded-xl border border-primary/30 bg-card p-4 sm:p-6"
          >
            <SectionHeader
              icon={UserPlus}
              title="Adicionar usuário"
              description="O novo participante começa com pontos e chineladas zerados."
            />

            <div className="grid gap-4 md:grid-cols-3">
              <FormInput
                id="new-user-email"
                label="E-mail"
                type="email"
                value={newUserEmail}
                onChange={setNewUserEmail}
              />
              <FormInput
                id="new-user-name"
                label="Nome completo"
                value={newUserName}
                onChange={setNewUserName}
              />
              <FormInput
                id="new-user-phone"
                label="Telefone"
                type="tel"
                value={newUserPhone}
                onChange={setNewUserPhone}
                placeholder="+5581979142974"
              />
            </div>

            {userCreationError ? <InlineError message={userCreationError} /> : null}
            {createdUser ? <CreatedUserMessage user={createdUser} /> : null}

            <Button type="submit" disabled={userCreating} className="mt-5 w-full sm:w-auto">
              {userCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {userCreating ? "Adicionando..." : "Adicionar usuário"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="bugs" className="mt-5">
          <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionHeader
                icon={Bug}
                title="Chamados"
                description="Acompanhe os relatos enviados e feche os que já foram tratados."
                className="mb-0"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={loadReports}
                disabled={reportsLoading}
                className="w-full sm:w-auto"
              >
                {reportsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Atualizar
              </Button>
            </div>

            {reportsError ? <InlineError message={reportsError} /> : null}

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <Button
                type="button"
                variant={reportFilter === "open" ? "default" : "ghost"}
                onClick={() => setReportFilter("open")}
              >
                Em aberto
                <Badge variant="secondary">{openReports.length}</Badge>
              </Button>
              <Button
                type="button"
                variant={reportFilter === "closed" ? "default" : "ghost"}
                onClick={() => setReportFilter("closed")}
              >
                Fechados
                <Badge variant="secondary">{closedReports.length}</Badge>
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {reportsLoading && reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">Carregando chamados...</p>
              ) : visibleReports.length ? (
                visibleReports.map((report) => (
                  <BugReportCard
                    key={report.id}
                    report={report}
                    updating={updatingReportId === report.id}
                    onStatusChange={() => void handleReportStatus(report)}
                  />
                ))
              ) : (
                <EmptyMessage
                  message={
                    reportFilter === "open"
                      ? "Nenhum chamado em aberto."
                      : "Nenhum chamado fechado ainda."
                  }
                />
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="sync" className="mt-5">
          <SyncDiagnosticsSection
            executions={syncExecutions}
            loading={syncLoading}
            error={syncError}
            playersSyncing={playersSyncing}
            playersSyncMessage={playersSyncMessage}
            onRefresh={() => void loadSyncExecutions()}
            onPlayersSync={() => void handlePlayersSync()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SyncDiagnosticsSection({
  executions,
  loading,
  error,
  playersSyncing,
  playersSyncMessage,
  onRefresh,
  onPlayersSync,
}: {
  executions: SyncExecution[];
  loading: boolean;
  error: string | null;
  playersSyncing: boolean;
  playersSyncMessage: string | null;
  onRefresh: () => void;
  onPlayersSync: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          icon={Activity}
          title="Monitor do sincronizador"
          description="Últimas 20 execuções. A lista atualiza automaticamente a cada 30 segundos."
          className="mb-0"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={onPlayersSync}
            disabled={playersSyncing}
            className="w-full sm:w-auto"
          >
            {playersSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Sincronizar jogadores
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onRefresh}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Atualizar agora
          </Button>
        </div>
      </div>

      {error ? <InlineError message={error} /> : null}
      {playersSyncMessage ? (
        <p className="mt-3 rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm font-semibold text-primary">
          {playersSyncMessage}
        </p>
      ) : null}

      <div className="mt-5 space-y-3">
        {loading && executions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Carregando execuções...</p>
        ) : executions.length ? (
          executions.map((execution) => (
            <SyncExecutionCard key={execution.id} execution={execution} />
          ))
        ) : (
          <EmptyMessage message="Nenhuma execução registrada depois da atualização de diagnóstico." />
        )}
      </div>
    </section>
  );
}

function SyncExecutionCard({ execution }: { execution: SyncExecution }) {
  const running = execution.sucesso == null && !execution.finalizado_em;
  const summary = execution.resumo ?? {};
  const isPlayersSync = summary.jogadores_salvos != null || summary.selecoes_processadas != null;
  const idle = execution.sucesso === true && !isPlayersSync && (summary.jogos_elegiveis ?? 0) === 0;
  const statusLabel = running
    ? "Executando"
    : idle
      ? "Sem jogos elegíveis"
      : execution.sucesso
        ? "Sucesso"
        : "Erro";
  const summaryLabel = isPlayersSync
    ? `${summary.modo === "completo" ? "Refresh completo" : "Pendentes"}: ${
        summary.jogadores_salvos ?? 0
      } jogadores em ${summary.selecoes_processadas ?? 0} seleção(ões)`
    : `${summary.jogos_sincronizados ?? 0}/${summary.jogos_elegiveis ?? 0} jogos atualizados`;

  return (
    <details className="group rounded-lg border border-border bg-background/50">
      <summary className="cursor-pointer list-none p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={execution.sucesso === false ? "destructive" : "secondary"}>
              {statusLabel}
            </Badge>
            <strong className="text-sm">{formatDateTime(execution.iniciado_em)}</strong>
            {execution.duracao_ms != null ? (
              <span className="text-xs text-muted-foreground">{execution.duracao_ms} ms</span>
            ) : null}
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{summaryLabel}</span>
        </div>
        {execution.erro ? <p className="mt-3 text-sm text-destructive">{execution.erro}</p> : null}
        {execution.legado ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Esta execução veio do contador antigo do cron. A versão que a executou não gravava
            histórico detalhado.
          </p>
        ) : null}
      </summary>

      <div className="border-t border-border p-4">
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {isPlayersSync ? (
            <>
              <Metric label="Seleções processadas" value={summary.selecoes_processadas ?? 0} />
              <Metric label="Jogadores salvos" value={summary.jogadores_salvos ?? 0} />
            </>
          ) : (
            <>
              <Metric label="Jogos encerrados" value={summary.jogos_encerrados ?? 0} />
              <Metric label="Estatísticas salvas" value={summary.estatisticas_sincronizadas ?? 0} />
            </>
          )}
          <Metric label="Chamadas registradas" value={execution.diagnosticos?.length ?? 0} />
        </div>

        <div className="space-y-3">
          {(execution.diagnosticos ?? []).map((diagnostic, index) => (
            <SyncDiagnosticCard
              key={`${diagnostic.evento_id}-${diagnostic.tipo}-${index}`}
              diagnostic={diagnostic}
            />
          ))}
          {!execution.diagnosticos?.length ? (
            <EmptyMessage
              message={
                execution.legado
                  ? (summary.jogos_elegiveis ?? 0) === 0
                    ? "Nenhum jogo estava elegível, então nenhuma chamada à API era esperada. O cron ainda precisa receber a versão com histórico detalhado."
                    : "A versão antiga do cron não armazenou a resposta da API."
                  : "Esta execução não fez chamadas ao provedor."
              }
            />
          ) : null}
        </div>
      </div>
    </details>
  );
}

function SyncDiagnosticCard({ diagnostic }: { diagnostic: SyncDiagnostic }) {
  return (
    <article className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={diagnostic.erro ? "destructive" : "secondary"}>{diagnostic.tipo}</Badge>
        <strong className="text-sm">{diagnostic.jogo}</strong>
        <span className="font-mono text-xs text-muted-foreground">
          evento {diagnostic.evento_id}
        </span>
      </div>

      {diagnostic.erro ? <p className="mt-3 text-sm text-destructive">{diagnostic.erro}</p> : null}

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
        <JsonBlock title="Interpretação usada pelo bolão" value={diagnostic.interpretado} />
        <JsonBlock title="Resposta bruta da API" value={diagnostic.resposta} />
      </div>
    </article>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary">
        {title}
      </p>
      <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function PendingReport({
  overview,
  loading,
  error,
  onRefresh,
}: {
  overview: AdminOverview | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const pendingCount =
    overview?.pending_users.reduce((total, user) => total + user.jogos_pendentes.length, 0) ?? 0;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          icon={ClockAlert}
          title="Palpites pendentes"
          description="Usuários sem palpite em jogos que começam nas próximas 24 horas."
          className="mb-0"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={onRefresh}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      {error ? <InlineError message={error} /> : null}

      {overview ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Usuários atrasados" value={overview.pending_users.length} />
          <Metric label="Palpites faltantes" value={pendingCount} />
          <Metric label="Jogos em até 24h" value={overview.urgent_games.length} />
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {loading && !overview ? (
          <p className="text-sm text-muted-foreground">Calculando pendências...</p>
        ) : overview?.pending_users.length ? (
          overview.pending_users.map((user) => <PendingUserCard key={user.id} user={user} />)
        ) : overview && overview.urgent_games.length === 0 ? (
          <EmptyMessage message="Não há jogos começando nas próximas 24 horas." />
        ) : overview ? (
          <EmptyMessage message="Todos os participantes já palpitaram nos jogos das próximas 24 horas." />
        ) : null}
      </div>
    </section>
  );
}

function SpecialAnswersSection({
  answers,
  participants,
  loading,
  saving,
  message,
  onRefresh,
  onSave,
  onChange,
  onClear,
}: {
  answers: Record<string, string>;
  participants: SpecialParticipant[];
  loading: boolean;
  saving: boolean;
  message: string | null;
  onRefresh: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (questionId: string, answer: string) => void;
  onClear: (questionId: string) => void;
}) {
  const answeredCount = ESPECIAIS.filter((question) => answers[question.id]).length;

  return (
    <form onSubmit={onSave} className="rounded-xl border border-primary/30 bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          icon={CheckCircle2}
          title="Respostas corretas"
          description="Marque manualmente o gabarito dos palpites especiais ao longo da Copa."
          className="mb-0"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={onRefresh}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Perguntas com resposta" value={answeredCount} />
        <Metric label="Perguntas totais" value={ESPECIAIS.length} />
        <Metric label="Participantes disponíveis" value={participants.length} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {ESPECIAIS.map((question, index) => {
          const answer = answers[question.id] ?? "";
          const isBolaoChampion = question.id === CAMPEAO_BOLAO_QUESTION_ID;
          const options = isBolaoChampion
            ? participants.map((participant) => ({
                value: participant.id,
                label: participant.nome_completo,
              }))
            : question.options.map((option) => ({ value: option, label: option }));

          return (
            <article
              key={question.id}
              className="rounded-lg border border-border bg-background/50 p-4"
            >
              <div className="mb-4 flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/12 font-display text-xs font-black text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="font-display text-sm font-black leading-snug">
                    {question.question}
                  </h4>
                  {answer ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Atual: {formatSpecialAnswer(answer, participants)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Sem resposta correta ainda</p>
                  )}
                </div>
                {answer ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={answer}
                  onValueChange={(value) => onChange(question.id, value)}
                  disabled={loading || saving || options.length === 0}
                >
                  <SelectTrigger className="h-11 rounded-xl border-border bg-card font-bold">
                    <SelectValue placeholder="Selecione a resposta correta" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onClear(question.id)}
                  disabled={loading || saving || !answer}
                  className="sm:w-24"
                >
                  Limpar
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {message ? (
        <p className="mt-4 rounded-lg border border-border bg-background/50 p-3 text-sm">
          {message}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={loading || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar respostas corretas"}
        </Button>
      </div>
    </form>
  );
}

function PendingUserCard({ user }: { user: PendingUser }) {
  return (
    <article className="rounded-lg border border-border bg-background/50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="font-display font-black">
            <BrazilThemedName>{user.nome_completo}</BrazilThemedName>
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant="destructive">
          {user.jogos_pendentes.length} pendente
          {user.jogos_pendentes.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {user.jogos_pendentes.map((game) => (
          <Link
            key={game.id}
            href={`/jogos/${game.id}`}
            className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50"
          >
            <p className="text-sm font-bold">
              {game.time1} <span className="text-muted-foreground">x</span> {game.time2}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{formatGameDateTime(game.data)}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-4">
      <p className="text-2xl font-black text-primary">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function SyncStatus({ status }: { status: AdminOverview["sync_status"] }) {
  if (!status) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Sincronizador aguardando a primeira execução.
      </p>
    );
  }

  const running = Boolean(
    status.bloqueado_ate && new Date(status.bloqueado_ate).getTime() > Date.now(),
  );
  const healthy = Boolean(
    status.ultimo_sucesso &&
    Date.now() - new Date(status.ultimo_sucesso).getTime() < 2 * 60_000 &&
    !status.ultimo_erro,
  );
  const label = running ? "Sincronizando" : healthy ? "Sincronizador saudável" : "Verificar sync";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant={status.ultimo_erro ? "destructive" : "secondary"}>{label}</Badge>
      {status.ultimo_sucesso ? (
        <span>Último sucesso: {formatDateTime(status.ultimo_sucesso)}</span>
      ) : null}
      <span>
        {status.jogos_sincronizados}/{status.jogos_elegiveis} jogos na última execução
      </span>
      {status.duracao_ms != null ? <span>{status.duracao_ms} ms</span> : null}
      {status.ultimo_erro ? <span className="text-destructive">{status.ultimo_erro}</span> : null}
    </div>
  );
}

function FormInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        required
      />
    </div>
  );
}

function CreatedUserMessage({ user }: { user: CreatedUser }) {
  return (
    <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-success">
        <Check className="h-4 w-4" />
        Usuário {user.email} criado.
      </p>
      <p className="mt-2 text-muted-foreground">
        Senha inicial:{" "}
        <strong className="select-all font-mono text-foreground">{user.temporaryPassword}</strong>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        A senha inicial é a parte do e-mail antes do @.
      </p>
      {user.emailConfirmationRequired ? (
        <p className="mt-2 text-xs font-medium text-foreground">
          O participante precisa confirmar o e-mail antes do primeiro acesso.
        </p>
      ) : null}
    </div>
  );
}

function AdminMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-4xl rounded-xl border border-destructive/40 bg-destructive/10 p-6">
      <AlertCircle className="mb-3 h-6 w-6 text-destructive" />
      <h2 className="font-display text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm text-destructive" role="alert">
        {message}
      </p>
      <Button asChild variant="secondary" className="mt-4">
        <Link href="/configuracoes">Voltar às configurações</Link>
      </Button>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: typeof Settings;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={`mb-5 flex items-center gap-3 ${className ?? ""}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-display text-lg font-black">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p
      className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
    >
      {message}
    </p>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-border bg-background/50 p-4 text-sm text-muted-foreground">
      {message}
    </p>
  );
}

function BugReportCard({
  report,
  updating,
  onStatusChange,
}: {
  report: BugReport;
  updating: boolean;
  onStatusChange: () => void;
}) {
  const closed = report.status === "resolvido";

  return (
    <article
      className={`rounded-lg border p-4 ${
        closed ? "border-success/30 bg-success/5" : "border-border bg-background/50"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display font-black">{report.nome ?? report.email}</h4>
            <Badge variant={closed ? "secondary" : "destructive"}>
              {closed ? "Fechado" : "Em aberto"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {report.email} · {formatDateTime(report.criado_em)}
          </p>
        </div>
        {report.pagina ? (
          <span className="rounded-full border border-border bg-card px-2 py-1 text-xs font-bold text-muted-foreground">
            {report.pagina}
          </span>
        ) : null}
      </div>

      <ReportField label="O que aconteceu?" value={report.descricao} />
      <ReportField label="Como reproduzir" value={report.passos} />
      <ReportField label="Esperado" value={report.esperado} />
      <ReportField label="Atual" value={report.atual} />
      <ReportField label="Navegador" value={report.navegador} compact />

      <Button
        type="button"
        variant={closed ? "secondary" : "default"}
        size="sm"
        className="mt-4 w-full sm:w-auto"
        onClick={onStatusChange}
        disabled={updating}
      >
        {updating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {updating ? "Atualizando..." : closed ? "Reabrir chamado" : "Fechar chamado"}
      </Button>
    </article>
  );
}

function ReportField({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | null;
  compact?: boolean;
}) {
  if (!value) return null;

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/85">{value}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  return formatLocalDateTime(value, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatGameOption(game: AdminGame) {
  return `${game.time1} x ${game.time2} · ${formatGameDateTime(game.data)}`;
}

function formatGameDateTime(value: string) {
  return formatLocalGameDateTime(value, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSpecialAnswer(answer: string, participants: SpecialParticipant[]) {
  return participants.find((participant) => participant.id === answer)?.nome_completo ?? answer;
}

function defaultHighlights(): Highlight[] {
  return [
    { slot: 1, jogo_id: null, url: "" },
    { slot: 2, jogo_id: null, url: "" },
  ];
}
