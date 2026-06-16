"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Globe2,
  type LucideIcon,
  MapPinned,
  Shield,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react";

import { Flag } from "@/components/common/Flag";
import { MatchDateGroups } from "@/components/common/MatchDateGroups";
import { SelectionLink } from "@/components/common/SelectionLink";
import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import mapaSvg from "@/app/mapa.svg";
import { teamCodeFromName } from "@/data/iso2";
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
type SelectionView = "informacoes" | "calendario" | "elenco";

export default function SelecaoPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [data, setData] = useState<SelecaoPerfilResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<SelectionView>("informacoes");

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
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-1">
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
                <div className="mt-3 space-y-4">
                  <HeaderMatchup selection={data.selecao} match={nextMatch} />
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

      <SelectionViewSwitcher view={view} onChange={setView} />

      {view === "informacoes" ? (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              icon={Sparkles}
              label="Confiança"
              value={
                data.confianca.percentual_vitoria == null
                  ? "-"
                  : `${data.confianca.percentual_vitoria}%`
              }
              featured
            />
            <MetricCard icon={Trophy} label="Pontos" value={data.selecao.pontos ?? "-"} />
            <MetricCard icon={Shield} label="Saldo" value={formatSigned(data.resumo.saldo_gols)} />
            <MetricCard icon={CalendarDays} label="Jogos" value={data.jogos.length} />
            <MetricCard icon={Target} label="Gols pró" value={data.resumo.gols_pro} />
          </section>

          <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(340px,1.1fr)_minmax(300px,0.95fr)_minmax(300px,0.95fr)]">
            <ConfidenceCard confidence={data.confianca} className="xl:row-span-2" />
            <SelectionIdentityCard selection={data.selecao} />
            <RecordCard data={data} />
            <StatisticsCard
              statistics={data.estatisticas}
              className="lg:col-span-2 xl:col-span-2"
            />
          </section>
        </div>
      ) : view === "elenco" ? (
        <RosterCard convocados={data.convocados} />
      ) : (
        <section className="mx-auto w-full max-w-4xl">
          <div className="text-center">
            <SectionTitle eyebrow="Calendário" title="Jogos da seleção" />
          </div>
          {data.jogos.length ? (
            <MatchDateGroups
              items={data.jogos}
              getKey={(jogo) => jogo.id}
              isLive={(jogo) => matchStatus(jogo) === "live"}
              layout="responsive-row"
              renderItem={(jogo) => (
                <SelectionMatchCard jogo={jogo} selectionName={data.selecao.nome} />
              )}
            />
          ) : (
            <EmptyState icon={CalendarDays} title="Nenhum jogo encontrado." />
          )}
        </section>
      )}
    </div>
  );
}

function SelectionViewSwitcher({
  view,
  onChange,
}: {
  view: SelectionView;
  onChange: (view: SelectionView) => void;
}) {
  const items = [
    { value: "informacoes" as const, label: "Informações", icon: Globe2 },
    { value: "calendario" as const, label: "Calendário", icon: CalendarDays },
    { value: "elenco" as const, label: "Elenco", icon: UsersRound },
  ];

  return (
    <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-border bg-card/85 p-1 sm:mx-auto sm:max-w-2xl">
      {items.map(({ value, label, icon: Icon }) => {
        const active = view === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-black transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function HeaderMatchup({
  selection,
  match,
}: {
  selection: SelecaoPerfilResponse["selecao"];
  match: Match;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <HeaderTeamFlag name={selection.nome} code={selection.codigo ?? undefined} />
      <span className="rounded-lg border border-border bg-background/60 px-3 py-2 font-display text-sm font-black text-muted-foreground">
        VS
      </span>
      <HeaderTeamFlag
        name={match.adversario}
        code={teamCodeFromName(match.adversario)}
        align="right"
      />
    </div>
  );
}

function HeaderTeamFlag({
  name,
  code,
  align = "left",
}: {
  name: string;
  code?: string;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
        <Flag code={code} name={name} size="md" static />
        <p className="line-clamp-2 font-display text-sm font-black leading-tight">{name}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  featured = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4",
        featured ? "border-primary/45 bg-primary/10 ring-yellow" : "border-border",
      )}
    >
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

function ConfidenceCard({
  confidence,
  className,
}: {
  confidence: SelecaoPerfilResponse["confianca"];
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-primary/25 bg-card p-5", className)}>
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
        <EmptyState
          icon={Sparkles}
          title="Ainda não há palpites suficientes para medir confiança."
        />
      )}
    </section>
  );
}

function SelectionIdentityCard({ selection }: { selection: SelecaoPerfilResponse["selecao"] }) {
  const identity = selection.identidade;

  if (!identity) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-5">
        <SectionTitle eyebrow="Mapa" title="Localização" />
        <div className="mb-4 grid grid-cols-2 gap-2">
          <IdentityPill
            icon={Globe2}
            label="Confederação"
            value={identity.confederation.code}
            detail={identity.confederation.name}
          />
          <IdentityPill icon={MapPinned} label="Região" value={identity.region} />
        </div>

        <MiniLocationMap location={identity.location} label={selection.nome} />
      </div>
    </section>
  );
}

function IdentityPill({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="h-4 w-4 shrink-0" />
        <p className="truncate text-[10px] font-black uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 truncate font-display text-lg font-black">{value}</p>
      {detail ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function MiniLocationMap({
  location,
  label,
}: {
  location: SelecaoPerfilResponse["selecao"]["identidade"] extends infer Identity
    ? Identity extends { location: infer Location }
      ? Location
      : never
    : never;
  label: string;
}) {
  const point = location.marker ?? projectLocation(location.latitude, location.longitude);
  const mapSrc = typeof mapaSvg === "string" ? mapaSvg : mapaSvg.src;

  return (
    <div
      className="relative aspect-[740/423] overflow-hidden rounded-xl border border-primary/20 bg-background/45"
      role="img"
      aria-label={`Localização aproximada de ${label}`}
    >
      <div className="absolute inset-0 bg-primary/[0.03]" />
      <img
        src={mapSrc}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain opacity-45 mix-blend-screen [filter:invert(86%)_sepia(34%)_saturate(768%)_hue-rotate(2deg)_brightness(104%)_contrast(92%)]"
      />
      <span
        className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20"
        style={{ left: `${point.x}%`, top: `${point.y}%` }}
      />
      <span
        className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_45%,transparent)]"
        style={{ left: `${point.x}%`, top: `${point.y}%` }}
      />
      <span
        className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
        style={{ left: `${point.x}%`, top: `${point.y}%` }}
      />
    </div>
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

function StatisticsCard({
  statistics,
  className,
}: {
  statistics: SelecaoPerfilResponse["estatisticas"];
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5", className)}>
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

type RosterPlayer = SelecaoPerfilResponse["convocados"]["jogadores"][number];
type RosterGroupKey = "goalkeepers" | "defenders" | "midfielders" | "attackers";
type RosterRole =
  | "goalkeeper"
  | "centre-back"
  | "left-back"
  | "right-back"
  | "defender"
  | "defensive-midfield"
  | "central-midfield"
  | "attacking-midfield"
  | "midfielder"
  | "left-wing"
  | "right-wing"
  | "centre-forward"
  | "forward"
  | "coach"
  | "unknown";
type RosterPlayerView = RosterPlayer & {
  displayPosition: string;
  group: RosterGroupKey | "coach";
  role: RosterRole;
};
type FieldRosterPlayer = RosterPlayerView & { group: RosterGroupKey };

const ROSTER_GROUPS: Array<{ key: RosterGroupKey; label: string }> = [
  { key: "goalkeepers", label: "GOLEIROS" },
  { key: "defenders", label: "DEFENSORES" },
  { key: "midfielders", label: "MEIAS" },
  { key: "attackers", label: "ATACANTES" },
];

const PITCH_LINES: Array<{ key: RosterGroupKey; label: string }> = [
  { key: "attackers", label: "Ataque" },
  { key: "midfielders", label: "Meio-campo" },
  { key: "defenders", label: "Defesa" },
  { key: "goalkeepers", label: "Goleiro" },
];

function RosterCard({ convocados }: { convocados: SelecaoPerfilResponse["convocados"] }) {
  const roster = splitRoster(convocados.jogadores.map(toRosterPlayerView));
  const players = roster.players;
  const coach = roster.coach;
  const groups = groupRosterPlayers(players);
  const formation = selectFormationPlayers(groups);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="Elenco" title="Convocados" />
        <div className="flex flex-wrap items-center gap-2">
          {players.length ? (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
              {players.length} jogadores{coach ? " + treinador" : ""}
            </span>
          ) : null}
          {convocados.sincronizado_em ? (
            <span className="rounded-full bg-background px-2 py-1 text-[10px] font-bold text-muted-foreground">
              {formatLocalTime(convocados.sincronizado_em)}
            </span>
          ) : null}
        </div>
      </div>

      {players.length ? (
        <div className="space-y-6">
          <RosterPitch formation={formation} />
          <div className="space-y-5">
            {ROSTER_GROUPS.map((group) => {
              const groupPlayers = groups[group.key];
              if (!groupPlayers.length) return null;

              return (
                <div key={group.key}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="font-display text-sm font-black tracking-wider text-primary">
                      {group.label}
                    </h3>
                    <span className="num text-xs font-bold text-muted-foreground">
                      {groupPlayers.length}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {groupPlayers.map((player) => (
                      <article
                        key={player.id}
                        className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background/35 p-3"
                      >
                        <PlayerPhoto player={player} />
                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-black">{player.nome}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                            {player.numero ? (
                              <span className="num rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                                #{player.numero}
                              </span>
                            ) : null}
                            <span className="truncate">{player.displayPosition}</span>
                          </div>
                          {player.clube ? (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {player.clube}
                            </p>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {coach ? <CoachCard coach={coach} /> : null}
        </div>
      ) : (
        <EmptyState
          icon={UsersRound}
          title={
            convocados.api_football_team_id
              ? "Convocados ainda não disponíveis no cache."
              : "Convocados ainda não disponíveis para esta seleção."
          }
        />
      )}

      {convocados.erro_sync ? (
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          Última tentativa de sync: {convocados.erro_sync}
        </p>
      ) : null}
    </section>
  );
}

function CoachCard({ coach }: { coach: RosterPlayerView }) {
  return (
    <div className="border-t border-border pt-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-black tracking-wider text-primary">TREINADOR</h3>
      </div>
      <article className="flex min-w-0 items-center gap-3 rounded-lg border border-primary/25 bg-primary/10 p-3">
        <PlayerPhoto player={coach} />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-black">{coach.nome}</p>
          <p className="mt-1 text-xs font-bold text-muted-foreground">{coach.displayPosition}</p>
          {coach.clube ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{coach.clube}</p>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function PlayerPhoto({
  player,
  size = "list",
}: {
  player: RosterPlayerView;
  size?: "list" | "field";
}) {
  const className = size === "field" ? "h-16 w-16 sm:h-[72px] sm:w-[72px]" : "h-14 w-14";

  if (!player.foto_url) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-primary/25 bg-muted text-muted-foreground ring-2 ring-background",
          className,
        )}
      >
        <UserRound className={size === "field" ? "h-6 w-6" : "h-5 w-5"} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "shrink-0 overflow-hidden rounded-full border border-primary/25 bg-muted ring-2 ring-background",
        className,
      )}
    >
      <img
        src={player.foto_url}
        alt={player.nome}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </span>
  );
}

function RosterPitch({ formation }: { formation: Record<RosterGroupKey, FieldRosterPlayer[]> }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(180deg,#15331f,#07110d)] p-3 shadow-inner">
      <div className="absolute inset-3 rounded-xl border border-primary/25" />
      <div className="absolute inset-x-[23%] top-3 h-12 rounded-b-full border-x border-b border-primary/20" />
      <div className="absolute inset-x-[23%] bottom-3 h-12 rounded-t-full border-x border-t border-primary/20" />
      <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20" />
      <div className="absolute inset-x-3 top-1/2 border-t border-primary/20" />

      <div className="relative z-10 grid min-h-[440px] grid-rows-4 gap-3 py-3">
        {PITCH_LINES.map((line) => {
          const players = formation[line.key];

          return (
            <div key={line.key} className="flex min-h-20 flex-col justify-center gap-2">
              <p className="text-center text-[9px] font-black uppercase tracking-[0.24em] text-primary/80">
                {line.label}
              </p>
              <div
                className={cn(
                  "mx-auto grid w-full max-w-xl items-center justify-center gap-2",
                  players.length === 1 && "grid-cols-[72px]",
                  players.length === 3 && "grid-cols-3",
                  players.length === 4 && "grid-cols-4",
                )}
              >
                {players.map((player) => (
                  <FieldPlayerMarker key={player.id} player={player} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldPlayerMarker({ player }: { player: FieldRosterPlayer }) {
  const title = player.numero
    ? `${player.nome} · #${player.numero} · ${player.displayPosition}`
    : `${player.nome} · ${player.displayPosition}`;

  return (
    <div className="group relative mx-auto grid justify-items-center" title={title}>
      <PlayerPhoto player={player} size="field" />
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden min-w-max -translate-x-1/2 rounded-lg border border-primary/30 bg-background px-2.5 py-1.5 text-center text-[10px] font-black shadow-xl group-hover:block">
        <span className="block max-w-36 truncate">{player.nome}</span>
        <span className="num mt-0.5 block text-primary">
          {player.numero ? `#${player.numero}` : player.displayPosition}
        </span>
      </span>
    </div>
  );
}

function splitRoster(roster: RosterPlayerView[]) {
  const coach = roster.find((player) => player.group === "coach") ?? null;
  const players = roster.filter(isFieldRosterPlayer);
  return { players, coach };
}

function isFieldRosterPlayer(player: RosterPlayerView): player is FieldRosterPlayer {
  return player.group !== "coach";
}

function groupRosterPlayers(players: FieldRosterPlayer[]) {
  const grouped = players.reduce<Record<RosterGroupKey, RosterPlayerView[]>>(
    (acc, player) => {
      acc[player.group].push(player);
      return acc;
    },
    { goalkeepers: [], defenders: [], midfielders: [], attackers: [] },
  );

  ROSTER_GROUPS.forEach(({ key }) => {
    grouped[key].sort(sortRosterPlayers);
  });

  return grouped;
}

function selectFormationPlayers(groups: Record<RosterGroupKey, RosterPlayerView[]>) {
  const used = new Set<string>();
  const pick = (
    candidates: RosterPlayerView[],
    predicate: (player: RosterPlayerView) => boolean = () => true,
  ) => {
    const player = candidates.find((candidate) => !used.has(candidate.id) && predicate(candidate));
    if (player) used.add(player.id);
    return player as FieldRosterPlayer | undefined;
  };
  const pickMany = (
    candidates: RosterPlayerView[],
    count: number,
    predicate: (player: RosterPlayerView) => boolean = () => true,
  ) => {
    const selected: FieldRosterPlayer[] = [];
    while (selected.length < count) {
      const player = pick(candidates, predicate);
      if (!player) break;
      selected.push(player);
    }
    return selected;
  };

  const goalkeeper = pick(groups.goalkeepers);
  const leftBack = pick(groups.defenders, (player) => player.role === "left-back");
  const centreBacks = pickMany(groups.defenders, 2, (player) => player.role === "centre-back");
  const rightBack = pick(groups.defenders, (player) => player.role === "right-back");
  const defenders = [
    leftBack,
    ...centreBacks,
    rightBack,
    ...pickMany(groups.defenders, 4 - [leftBack, ...centreBacks, rightBack].filter(Boolean).length),
  ].filter((player): player is FieldRosterPlayer => Boolean(player));
  const midfielders = [
    ...pickMany(groups.midfielders, 1, (player) => player.role === "defensive-midfield"),
    ...pickMany(groups.midfielders, 1, (player) => player.role === "central-midfield"),
    ...pickMany(groups.midfielders, 1, (player) => player.role === "attacking-midfield"),
  ];
  const attackers = [
    pick(groups.attackers, (player) => player.role === "left-wing"),
    pick(groups.attackers, (player) => player.role === "centre-forward"),
    pick(groups.attackers, (player) => player.role === "right-wing"),
  ].filter((player): player is FieldRosterPlayer => Boolean(player));

  return {
    attackers: [...attackers, ...pickMany(groups.attackers, 3 - attackers.length)].slice(0, 3),
    midfielders: [...midfielders, ...pickMany(groups.midfielders, 3 - midfielders.length)].slice(
      0,
      3,
    ),
    defenders: defenders.slice(0, 4),
    goalkeepers: goalkeeper ? [goalkeeper] : [],
  };
}

function sortRosterPlayers(a: RosterPlayerView, b: RosterPlayerView) {
  const numberA = Number(a.numero);
  const numberB = Number(b.numero);
  const hasNumberA = Number.isFinite(numberA);
  const hasNumberB = Number.isFinite(numberB);
  if (hasNumberA && hasNumberB && numberA !== numberB) return numberA - numberB;
  if (hasNumberA !== hasNumberB) return hasNumberA ? -1 : 1;
  return a.nome.localeCompare(b.nome, "pt-BR");
}

function toRosterPlayerView(player: RosterPlayer): RosterPlayerView {
  const position = translateRosterPosition(player.posicao);
  return {
    ...player,
    displayPosition: position.label,
    group: position.group,
    role: position.role,
  };
}

function translateRosterPosition(position: string | null): {
  label: string;
  group: RosterGroupKey | "coach";
  role: RosterRole;
} {
  const original = position?.trim();
  const normalized = normalizeRosterPosition(original);
  const exact: Record<string, { label: string; group: RosterGroupKey; role: RosterRole }> = {
    goalkeeper: { label: "Goleiro", group: "goalkeepers", role: "goalkeeper" },
    goleiro: { label: "Goleiro", group: "goalkeepers", role: "goalkeeper" },
    gk: { label: "Goleiro", group: "goalkeepers", role: "goalkeeper" },
    "centre back": { label: "Zagueiro", group: "defenders", role: "centre-back" },
    "center back": { label: "Zagueiro", group: "defenders", role: "centre-back" },
    zagueiro: { label: "Zagueiro", group: "defenders", role: "centre-back" },
    defender: { label: "Defensor", group: "defenders", role: "defender" },
    defensor: { label: "Defensor", group: "defenders", role: "defender" },
    "left back": { label: "Lateral Esquerdo", group: "defenders", role: "left-back" },
    "lateral esquerdo": { label: "Lateral Esquerdo", group: "defenders", role: "left-back" },
    "right back": { label: "Lateral Direito", group: "defenders", role: "right-back" },
    "lateral direito": { label: "Lateral Direito", group: "defenders", role: "right-back" },
    "full back": { label: "Lateral", group: "defenders", role: "defender" },
    lateral: { label: "Lateral", group: "defenders", role: "defender" },
    "defensive midfield": { label: "Volante", group: "midfielders", role: "defensive-midfield" },
    volante: { label: "Volante", group: "midfielders", role: "defensive-midfield" },
    "central midfield": {
      label: "Meio-campista Central",
      group: "midfielders",
      role: "central-midfield",
    },
    midfielder: { label: "Meio-campista", group: "midfielders", role: "midfielder" },
    meia: { label: "Meio-campista", group: "midfielders", role: "midfielder" },
    "meio campista": { label: "Meio-campista", group: "midfielders", role: "midfielder" },
    "attacking midfield": {
      label: "Meia-atacante",
      group: "midfielders",
      role: "attacking-midfield",
    },
    "left midfield": { label: "Meia Esquerda", group: "midfielders", role: "midfielder" },
    "right midfield": { label: "Meia Direita", group: "midfielders", role: "midfielder" },
    "left wing": { label: "Ponta Esquerda", group: "attackers", role: "left-wing" },
    "ponta esquerda": { label: "Ponta Esquerda", group: "attackers", role: "left-wing" },
    "right wing": { label: "Ponta Direita", group: "attackers", role: "right-wing" },
    "ponta direita": { label: "Ponta Direita", group: "attackers", role: "right-wing" },
    winger: { label: "Ponta", group: "attackers", role: "forward" },
    ponta: { label: "Ponta", group: "attackers", role: "forward" },
    forward: { label: "Atacante", group: "attackers", role: "forward" },
    atacante: { label: "Atacante", group: "attackers", role: "forward" },
    striker: { label: "Atacante", group: "attackers", role: "centre-forward" },
    "centre forward": { label: "Centroavante", group: "attackers", role: "centre-forward" },
    "center forward": { label: "Centroavante", group: "attackers", role: "centre-forward" },
    centroavante: { label: "Centroavante", group: "attackers", role: "centre-forward" },
    "second striker": { label: "Segundo Atacante", group: "attackers", role: "forward" },
  };

  if (isCoachRosterPosition(normalized))
    return { label: "Treinador", group: "coach", role: "coach" };
  if (exact[normalized]) return exact[normalized];
  if (normalized.includes("goalkeeper") || normalized.includes("goleiro")) {
    return { label: "Goleiro", group: "goalkeepers", role: "goalkeeper" };
  }
  if (normalized.includes("back") || normalized.includes("defender")) {
    if (normalized.includes("left")) {
      return { label: original ?? "Lateral Esquerdo", group: "defenders", role: "left-back" };
    }
    if (normalized.includes("right")) {
      return { label: original ?? "Lateral Direito", group: "defenders", role: "right-back" };
    }
    if (normalized.includes("centre") || normalized.includes("center")) {
      return { label: original ?? "Zagueiro", group: "defenders", role: "centre-back" };
    }
    return { label: original ?? "Defensor", group: "defenders", role: "defender" };
  }
  if (normalized.includes("zagueiro")) {
    return { label: original ?? "Zagueiro", group: "defenders", role: "centre-back" };
  }
  if (normalized.includes("lateral")) {
    if (normalized.includes("esquerdo")) {
      return { label: original ?? "Lateral Esquerdo", group: "defenders", role: "left-back" };
    }
    if (normalized.includes("direito")) {
      return { label: original ?? "Lateral Direito", group: "defenders", role: "right-back" };
    }
    return { label: original ?? "Lateral", group: "defenders", role: "defender" };
  }
  if (normalized.includes("midfield")) {
    return { label: original ?? "Meio-campista", group: "midfielders", role: "midfielder" };
  }
  if (normalized.includes("meia") || normalized.includes("volante")) {
    return {
      label: original ?? "Meio-campista",
      group: "midfielders",
      role: normalized.includes("volante") ? "defensive-midfield" : "midfielder",
    };
  }
  if (
    normalized.includes("wing") ||
    normalized.includes("forward") ||
    normalized.includes("striker") ||
    normalized.includes("attack")
  ) {
    return { label: original ?? "Atacante", group: "attackers", role: "forward" };
  }
  if (normalized.includes("ponta") || normalized.includes("atacante")) {
    return { label: original ?? "Atacante", group: "attackers", role: "forward" };
  }

  return { label: original ?? "Jogador", group: "midfielders", role: "unknown" };
}

function isCoachRosterPosition(normalized: string) {
  return (
    normalized.includes("coach") ||
    normalized.includes("manager") ||
    normalized.includes("trainer") ||
    normalized.includes("head coach")
  );
}

function normalizeRosterPosition(position: string | null | undefined) {
  return (position ?? "")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ");
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

function projectLocation(latitude: number, longitude: number) {
  return {
    x: Math.min(97, Math.max(3, ((longitude + 180) / 360) * 100)),
    y: Math.min(97, Math.max(3, ((90 - latitude) / 180) * 100)),
  };
}
