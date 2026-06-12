"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  BarChart3,
  MessageCircle,
  Play,
  Radio,
  Target,
  Trophy,
  Users,
} from "lucide-react";

import { Flag } from "@/components/common/Flag";
import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { teamCodeFromName } from "@/data/iso2";
import { getInitials } from "@/lib/display-name";
import { getCurrentUsuario, getPalpitesDoJogo, type JogoPalpitesResponse } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type TabValue = "dashboard" | "transmissao";

type ChatMessage = {
  id: string;
  user_id: string | null;
  nome: string;
  texto: string;
  enviado_em: string;
};

const COLORS = ["var(--primary)", "var(--success)", "var(--warning)", "var(--destructive)"];

export default function JogoDetalhePage() {
  const params = useParams<{ id: string }>();
  const jogoId = params.id;
  const [data, setData] = useState<JogoPalpitesResponse | null>(null);
  const [tab, setTab] = useState<TabValue>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const syncAndReload = useCallback(async () => {
    try {
      const response = await fetch("/api/jogos/sync", { method: "POST" });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível sincronizar os placares.");
      }

      await load();
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Não foi possível sincronizar os placares.",
      );
    }
  }, [load]);

  useEffect(() => {
    load({ showLoading: true });
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const isLive = useMemo(() => {
    void nowTick;
    return data
      ? !data.jogo.encerrado && new Date(data.jogo.data).getTime() <= nowAsStoredBrasiliaMs()
      : false;
  }, [data, nowTick]);

  useEffect(() => {
    if (!isLive) return;
    syncAndReload();
    const interval = window.setInterval(syncAndReload, 30_000);
    return () => window.clearInterval(interval);
  }, [isLive, syncAndReload]);

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
              <KpiCard icon={Target} label="Mais comum" value={dashboard.mostPopularScore} />
              <KpiCard icon={Trophy} label="Chineladas" value={dashboard.chineladas} />
            </div>
          </div>
        </header>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-border bg-card/80 p-1 sm:w-fit sm:min-w-[360px]">
          <TabsTrigger value="dashboard" className="gap-1.5 py-2.5">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="transmissao" className="gap-1.5 py-2.5">
            <Play className="h-4 w-4" />
            Transmissão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab data={dashboard} />
        </TabsContent>

        <TabsContent value="transmissao" className="mt-6">
          <TransmissaoTab data={data} isActive={tab === "transmissao"} isLive={isLive} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function DashboardTab({ data }: { data: ReturnType<typeof buildDashboard> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 font-display text-lg font-black">Distribuição dos palpites</h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.scoreBars} margin={{ left: -18, right: 8, top: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="score" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--primary) 12%, transparent)" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                }}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 font-display text-lg font-black">Resultado previsto</h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
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
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {data.resultPie.map((item, index) => (
            <div key={item.label} className="rounded-lg border border-border bg-background/45 p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                {item.label}
              </div>
              <p className="num mt-1 font-display text-xl font-black">{item.count}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
        <h3 className="mb-4 font-display text-lg font-black">Todos os palpites</h3>
        {data.rows.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.rows.map((row) => (
              <div
                key={row.user_id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-background/45 p-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-black text-primary">
                    {getInitials(row.nome_completo)}
                  </span>
                  <span className="truncate text-sm font-semibold">{row.nome_completo}</span>
                </span>
                <span className="num font-display text-lg font-black">
                  {row.palpite.gols1} x {row.palpite.gols2}
                </span>
              </div>
            ))}
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
}: {
  data: JogoPalpitesResponse;
  isActive: boolean;
  isLive: boolean;
}) {
  const embedUrl = toEmbedUrl(data.jogo.transmissao_url);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-lg font-black">Transmissão</h3>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider",
              isLive ? "bg-live/15 text-live" : "bg-muted text-muted-foreground",
            )}
          >
            <Radio className="h-3 w-3" />
            {isLive ? "ao vivo" : "fora do ar"}
          </span>
        </div>
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={`Transmissão de ${data.jogo.time1} x ${data.jogo.time2}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="aspect-video w-full bg-background"
          />
        ) : (
          <div className="grid aspect-video place-items-center bg-background/60 p-8 text-center">
            <div>
              <Play className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">Link da transmissão ainda não cadastrado.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Preencha `transmissao_url` em `public.jogos` para exibir o player.
              </p>
            </div>
          </div>
        )}
      </section>

      <ChatPanel jogoId={data.jogo.id} isActive={isActive} isLive={isLive} />
    </div>
  );
}

function ChatPanel({
  jogoId,
  isActive,
  isLive,
}: {
  jogoId: string;
  isActive: boolean;
  isLive: boolean;
}) {
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
    if (!isActive || !isLive) return;

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
  }, [isActive, isLive, jogoId]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text || !channel || !isLive) return;

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
    <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-display text-lg font-black">Chat do jogo</h3>
        <p className="text-xs text-muted-foreground">
          {isLive
            ? "Canal aberto enquanto a partida estiver em andamento."
            : "O chat abre quando o jogo estiver ao vivo."}
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
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
          disabled={!isLive || !channel}
          placeholder={isLive ? "Escreva uma mensagem..." : "Chat fechado"}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
        />
        <Button type="submit" disabled={!message.trim() || !isLive || !channel}>
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
  });

  const scoreBars = [...scoreCount.entries()]
    .map(([score, count]) => ({ score, count }))
    .sort((a, b) => b.count - a.count || a.score.localeCompare(b.score))
    .slice(0, 12);
  const mostPopularScore = scoreBars[0]?.score ?? "-";

  return {
    totalPalpites: data.palpites.length,
    mostPopularScore,
    chineladas: data.palpites.filter((item) => item.chinelada).length,
    scoreBars,
    resultPie: [...resultCount.entries()].map(([label, count]) => ({ label, count })),
    rows: data.palpites,
  };
}

function toEmbedUrl(url: string | null | undefined) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    if (parsed.hostname.includes("youtu.be")) {
      const videoId = parsed.pathname.replace("/", "");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    return url;
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
