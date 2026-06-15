"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  type LucideIcon,
  Shield,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import { Flag } from "@/components/common/Flag";
import { MatchDateGroups } from "@/components/common/MatchDateGroups";
import { SelectionLink } from "@/components/common/SelectionLink";
import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  formatLocalGameDateTime,
  formatLocalGameTime,
  formatLocalTime,
} from "@/lib/local-datetime";
import { formatStatisticValue, getStatisticLabel } from "@/lib/match-statistics";
import { getSelecaoPerfil, type SelecaoPerfilResponse } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

type Match = SelecaoPerfilResponse["jogos"][number];

export default function SelecaoPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [data, setData] = useState<SelecaoPerfilResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const perfil = await getSelecaoPerfil(slug);
      setData(perfil);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeRefresh({
    channelName: "selection-profile",
    signals: ["grupos", "jogos", "palpites"],
    onRefresh: () => {
      void loadData();
    },
  });

  const liveMatch = useMemo(
    () => data?.jogos.find((jogo) => matchStatus(jogo) === "live") ?? null,
    [data?.jogos],
  );
  const nextMatch = useMemo(
    () => liveMatch ?? data?.jogos.find((jogo) => matchStatus(jogo) === "scheduled") ?? null,
    [data?.jogos, liveMatch],
  );

  if (loading) {
    return <SpinningBallLoader label="Carregando seleção" className="min-h-[420px]" />;
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-6">
        <p className="font-display text-xl font-black">Não foi possível carregar a seleção.</p>
        <p className="mt-2 text-sm text-muted-foreground">{error ?? "Tente novamente em breve."}</p>
        <Button asChild variant="secondary" className="mt-5">
          <Link href="/grupos">Voltar para a Copa</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/grupos">
          <ArrowLeft className="h-4 w-4" />
          Copa
        </Link>
      </Button>

      <header className="overflow-hidden rounded-2xl border border-primary/30 bg-card">
        <div className="relative p-5 sm:p-7">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/12 to-transparent" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.45fr)] lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <Flag
                code={data.selecao.codigo ?? undefined}
                name={data.selecao.nome}
                size="xl"
                static
                className="shadow-xl"
              />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                  Perfil da seleção
                </p>
                <h1 className="mt-1 truncate font-display text-3xl font-black sm:text-5xl">
                  {data.selecao.nome}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {data.selecao.grupo ? (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                      Grupo {data.selecao.grupo}
                    </span>
                  ) : null}
                  {data.selecao.posicao ? <span>{data.selecao.posicao}º lugar</span> : null}
                  {liveMatch ? <StatusBadge status="live" /> : null}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/45 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                {liveMatch ? "Agora" : "Próximo compromisso"}
              </p>
              {nextMatch ? (
                <div className="mt-3">
                  <p className="font-display text-lg font-black">
                    {data.selecao.nome} <span className="text-muted-foreground">x</span>{" "}
                    {nextMatch.adversario}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-primary">
                    {formatLocalGameDateTime(nextMatch.data)}
                  </p>
                  <Button asChild size="sm" variant="secondary" className="mt-4">
                    <Link href={`/jogos/${nextMatch.id}`}>Ver jogo</Link>
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nenhum próximo jogo encontrado para esta seleção.
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard icon={Trophy} label="Pontos" value={data.selecao.pontos ?? "-"} />
        <MetricCard icon={Shield} label="Saldo" value={formatSigned(data.resumo.saldo_gols)} />
        <MetricCard icon={CalendarDays} label="Jogos" value={data.jogos.length} />
        <MetricCard icon={Target} label="Gols pró" value={data.resumo.gols_pro} />
        <MetricCard
          icon={Sparkles}
          label="Confiança"
          value={
            data.confianca.percentual_vitoria == null
              ? "-"
              : `${data.confianca.percentual_vitoria}%`
          }
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div>
          <SectionTitle eyebrow="Calendário" title="Jogos da seleção" />
          {data.jogos.length ? (
            <MatchDateGroups
              items={data.jogos}
              getKey={(jogo) => jogo.id}
              isLive={(jogo) => matchStatus(jogo) === "live"}
              renderItem={(jogo) => <SelectionMatchCard jogo={jogo} selectionName={data.selecao.nome} />}
            />
          ) : (
            <EmptyState icon={CalendarDays} title="Nenhum jogo encontrado." />
          )}
        </div>

        <div className="space-y-5">
          <ConfidenceCard confidence={data.confianca} />
          <RecordCard data={data} />
          <StatisticsCard statistics={data.estatisticas} />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="num mt-1 font-display text-2xl font-black">{value}</p>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="font-display text-2xl font-black">{title}</h2>
    </div>
  );
}

function SelectionMatchCard({ jogo, selectionName }: { jogo: Match; selectionName: string }) {
  const status = matchStatus(jogo);
  const hasScore = jogo.gols1 != null && jogo.gols2 != null;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors",
        status === "live" && "border-live/60 bg-live/[0.08]",
        status === "finished" && "border-border bg-card/70",
        status === "scheduled" && "border-primary/25",
      )}
    >
      <div
        className={cn(
          "h-1 w-full",
          status === "live" && "bg-live",
          status === "finished" && "bg-muted-foreground/40",
          status === "scheduled" && "bg-primary",
        )}
      />
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-wider text-primary">
              {jogo.fase}
              {jogo.grupo ? ` · Grupo ${jogo.grupo}` : ""}
              {jogo.rodada ? ` · R${jogo.rodada}` : ""}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {formatLocalGameTime(jogo.data)}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamName name={jogo.time1} active={jogo.time1 === selectionName} />
          <div className="text-center">
            {hasScore ? (
              <div
                className={cn(
                  "num rounded-lg border px-3 py-1 font-display text-2xl font-black",
                  status === "live"
                    ? "border-live/40 bg-live/10 text-live"
                    : "border-border bg-background/50",
                )}
              >
                {jogo.gols1} <span className="text-muted-foreground">x</span> {jogo.gols2}
              </div>
            ) : (
              <span className="rounded-lg border border-border bg-background/40 px-3 py-2 font-display text-sm font-black text-muted-foreground">
                VS
              </span>
            )}
          </div>
          <TeamName name={jogo.time2} active={jogo.time2 === selectionName} align="right" />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-xs font-semibold text-muted-foreground">
            {jogo.encerrado ? "Resultado final" : "Partida da Copa"}
          </span>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/jogos/${jogo.id}`}>Ver detalhes</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function TeamName({
  name,
  active,
  align = "left",
}: {
  name: string;
  active: boolean;
  align?: "left" | "right";
}) {
  if (active) {
    return (
      <div className={cn("min-w-0", align === "right" && "text-right")}>
        <p className="line-clamp-2 font-display text-sm font-black">{name}</p>
        <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-primary">
          Seleção
        </p>
      </div>
    );
  }

  return (
    <SelectionLink
      name={name}
      align={align}
      flagSize="md"
      truncateName={false}
      className={cn("max-w-full", align === "right" && "justify-end")}
      nameClassName="line-clamp-2 whitespace-normal font-display text-sm font-black leading-tight"
    />
  );
}

function ConfidenceCard({ confidence }: { confidence: SelecaoPerfilResponse["confianca"] }) {
  return (
    <section className="rounded-2xl border border-primary/25 bg-card p-5">
      <SectionTitle eyebrow="Palpites" title="Confiança da galera" />
      {confidence.total_palpites > 0 ? (
        <div className="space-y-4">
          <div>
            <p className="num font-display text-4xl font-black text-primary">
              {confidence.percentual_vitoria}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              dos palpites apontam vitória desta seleção.
            </p>
          </div>
          <ConfidenceBar label="Vitória" value={confidence.percentual_vitoria ?? 0} />
          <ConfidenceBar label="Empate" value={confidence.percentual_empate ?? 0} />
          <ConfidenceBar label="Derrota" value={confidence.percentual_derrota ?? 0} />
          <p className="text-xs text-muted-foreground">
            Base: {confidence.total_palpites}{" "}
            {confidence.total_palpites === 1 ? "palpite" : "palpites"} · média prevista{" "}
            {confidence.media_gols_pro ?? "-"} x {confidence.media_gols_contra ?? "-"}
          </p>
        </div>
      ) : (
        <EmptyState icon={Sparkles} title="Ainda não há palpites suficientes para medir confiança." />
      )}
    </section>
  );
}

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-bold">
        <span>{label}</span>
        <span className="num text-primary">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RecordCard({ data }: { data: SelecaoPerfilResponse }) {
  const rows = [
    ["Vitórias", data.resumo.vitorias],
    ["Empates", data.resumo.empates],
    ["Derrotas", data.resumo.derrotas],
    ["Gols pró", data.resumo.gols_pro],
    ["Gols contra", data.resumo.gols_contra],
  ] as const;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <SectionTitle eyebrow="Campanha" title="Resumo da Copa" />
      <div className="grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-background/40 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="num mt-1 font-display text-xl font-black">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatisticsCard({ statistics }: { statistics: SelecaoPerfilResponse["estatisticas"] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <SectionTitle eyebrow="Números" title="Estatísticas" />
        {statistics.sincronizado_em ? (
          <span className="rounded-full bg-background px-2 py-1 text-[10px] font-bold text-muted-foreground">
            {formatLocalTime(statistics.sincronizado_em)}
          </span>
        ) : null}
      </div>
      {statistics.itens.length ? (
        <div className="space-y-2">
          {statistics.itens.slice(0, 8).map((statistic) => (
            <div
              key={statistic.name}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/35 px-3 py-2"
            >
              <span className="truncate text-sm font-semibold text-muted-foreground">
                {getStatisticLabel(statistic.name)}
              </span>
              <span className="num font-display text-lg font-black">
                {formatStatisticValue(statistic.name, statistic.total)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Activity} title="Estatísticas ainda não disponíveis." />
      )}
    </section>
  );
}

function EmptyState({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background/30 px-4 py-8 text-center">
      <Icon className="mx-auto h-7 w-7 text-muted-foreground/60" />
      <p className="mt-3 text-sm font-semibold text-muted-foreground">{title}</p>
    </div>
  );
}

function matchStatus(jogo: Pick<Match, "encerrado" | "placar_status">) {
  if (jogo.placar_status === "live") return "live";
  if (jogo.encerrado || jogo.placar_status === "finished") return "finished";
  return "scheduled";
}

function formatSigned(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}
