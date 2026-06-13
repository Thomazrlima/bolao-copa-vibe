import Link from "next/link";
import { CalendarDays, ExternalLink, Play, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RealtimeRouterRefresh } from "@/components/realtime/RealtimeRouterRefresh";
import { createClient } from "@/lib/supabase/server";

type HighlightRow = {
  slot: number;
  jogo_id: string;
};

type GameRow = {
  id: string;
  time1: string;
  time2: string;
  data: string;
  encerrado: boolean;
  placar_status: "upcoming" | "live" | "finished" | null;
  transmissao_url: string | null;
};

export async function TransmissaoDestaques({
  pageMode,
}: {
  pageMode: "transmissao" | "melhores-momentos";
}) {
  const supabase = await createClient();
  const highlightsResult = await supabase
    .from("transmissao_destaques")
    .select("slot,jogo_id")
    .order("slot");

  if (highlightsResult.error) {
    return <EmptyHighlights message="Os jogos em destaque ainda não foram configurados." />;
  }

  const highlights = (highlightsResult.data ?? []) as HighlightRow[];
  const gameIds = highlights.map((highlight) => highlight.jogo_id);
  const gamesResult = gameIds.length
    ? await supabase
        .from("jogos")
        .select("id,time1,time2,data,encerrado,placar_status,transmissao_url")
        .in("id", gameIds)
    : { data: [], error: null };

  if (gamesResult.error) {
    return <EmptyHighlights message="Não foi possível carregar os jogos em destaque." />;
  }

  const gameById = new Map(((gamesResult.data ?? []) as GameRow[]).map((game) => [game.id, game]));
  const games = highlights
    .map((highlight) => gameById.get(highlight.jogo_id))
    .filter((game): game is GameRow => Boolean(game));
  const title = pageMode === "transmissao" ? "Transmissões em destaque" : "Melhores momentos";
  const description =
    pageMode === "transmissao"
      ? "Acompanhe os dois jogos selecionados pela organização do bolão."
      : "Reveja os jogos selecionados pela organização do bolão.";

  return (
    <div className="mx-auto max-w-6xl">
      <RealtimeRouterRefresh
        channelName={`transmissao-live:${pageMode}`}
        signals={["jogos", "transmissoes"]}
      />
      <header className="mb-6 sm:mb-8">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
          <Radio className="h-4 w-4" />
          Copa do Mundo 2026
        </p>
        <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>

      {games.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {games.map((game) => (
            <HighlightCard key={game.id} game={game} />
          ))}
        </div>
      ) : (
        <EmptyHighlights message="Os jogos em destaque ainda não foram configurados." />
      )}
    </div>
  );
}

function HighlightCard({ game }: { game: GameRow }) {
  const videoUrl = normalizeYoutubeUrl(game.transmissao_url);
  const thumbnailUrl = videoUrl ? getYoutubeThumbnailUrl(videoUrl) : null;
  const finished = game.encerrado || game.placar_status === "finished";
  const label = finished ? "Melhores momentos" : "Transmissão";

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">{label}</p>
          <h3 className="mt-1 font-display text-xl font-black">
            {game.time1} <span className="text-muted-foreground">x</span> {game.time2}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDateTime(game.data)}
          </p>
        </div>
      </div>

      {videoUrl ? (
        <a
          href={videoUrl}
          target="_blank"
          rel="noreferrer"
          className="group relative block aspect-video overflow-hidden bg-background"
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={`${label} de ${game.time1} x ${game.time2}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              <Play className="h-12 w-12" />
            </div>
          )}
          <div className="absolute inset-0 grid place-items-center bg-black/35 transition-colors group-hover:bg-black/20">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-primary-foreground shadow-lg">
              <Play className="h-5 w-5 fill-current" />
              Assistir
              <ExternalLink className="h-4 w-4" />
            </span>
          </div>
        </a>
      ) : (
        <div className="grid aspect-video place-items-center bg-background/60 p-6 text-center text-sm text-muted-foreground">
          Link ainda não cadastrado.
        </div>
      )}

      <div className="p-4">
        <Button asChild variant="secondary" className="w-full">
          <Link href={`/calendario/${game.id}`}>Abrir detalhes do jogo</Link>
        </Button>
      </div>
    </article>
  );
}

function EmptyHighlights({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <Radio className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function normalizeYoutubeUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function getYoutubeThumbnailUrl(url: string) {
  try {
    const parsed = new URL(url);
    let videoId: string | null = null;

    if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.replace("/", "");
    } else if (parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/shorts/")) {
      videoId = parsed.pathname.split("/")[2] ?? null;
    } else {
      videoId = parsed.searchParams.get("v");
    }

    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
