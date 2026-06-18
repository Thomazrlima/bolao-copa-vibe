import { NextResponse } from "next/server";

import { canManageUsers } from "@/lib/admin-users";
import { createClient } from "@/lib/supabase/server";

type GameRow = {
  id: string;
  fase_id: number;
  time1: string;
  time2: string;
  data: string;
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
  transmissao_url: string | null;
};

type UserRow = {
  id: string;
  nome_completo: string;
  email: string;
};

type GuessRow = {
  user_id: string;
  jogo_id: string;
};

type HighlightRow = {
  slot: number;
  jogo_id: string | null;
};

type AdminSyncStatus = {
  bloqueado_ate: string | null;
  ultima_tentativa: string | null;
  ultimo_sucesso: string | null;
  ultimo_erro: string | null;
  jogos_elegiveis: number;
  jogos_sincronizados: number;
  duracao_ms: number | null;
};

type OverviewRpcData = {
  users?: UserRow[];
  games?: GameRow[];
  highlights?: HighlightRow[];
  sync_status?: AdminSyncStatus | null;
  guesses?: GuessRow[];
};

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  const [overviewResult, gamesResult] = await Promise.all([
    supabase.rpc("admin_overview_bolao"),
    supabase
      .from("jogos")
      .select("id,fase_id,time1,time2,data,gols1,gols2,encerrado,transmissao_url")
      .order("data", { ascending: true }),
  ]);

  const error = overviewResult.error ?? gamesResult.error;

  if (error) {
    return NextResponse.json(
      { error: `Não foi possível carregar a administração: ${error.message}` },
      { status: 500 },
    );
  }

  const overview = (overviewResult.data ?? {}) as OverviewRpcData;
  const users = overview.users ?? [];
  const games = (gamesResult.data ?? []) as GameRow[];
  const now = nowAsStoredBrasiliaMs();
  const deadline = now + 24 * 60 * 60 * 1000;
  const urgentGames = games.filter((game) => {
    const startsAt = new Date(game.data).getTime();
    return !game.encerrado && startsAt > now && startsAt <= deadline;
  });

  const urgentGameIds = new Set(urgentGames.map((game) => game.id));
  const guessed = new Set(
    (overview.guesses ?? [])
      .filter((guess) => urgentGameIds.has(guess.jogo_id))
      .map((guess) => `${guess.user_id}:${guess.jogo_id}`),
  );

  const pendingUsers = users
    .map((user) => ({
      ...user,
      jogos_pendentes: urgentGames.filter((game) => !guessed.has(`${user.id}:${game.id}`)),
    }))
    .filter((user) => user.jogos_pendentes.length > 0);

  const highlightBySlot = new Map(
    (overview.highlights ?? []).map((highlight) => [highlight.slot, highlight.jogo_id]),
  );

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    pending_users: pendingUsers,
    urgent_games: urgentGames,
    games,
    sync_status: overview.sync_status ?? null,
    highlights: [1, 2].map((slot) => {
      const jogoId = highlightBySlot.get(slot) ?? null;
      const game = games.find((item) => item.id === jogoId) ?? null;
      return { slot, jogo_id: jogoId, url: game?.transmissao_url ?? "" };
    }),
  });
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!canManageUsers(data.user.email)) {
    return NextResponse.json(
      { error: "Você não tem permissão para acessar a administração." },
      { status: 403 },
    );
  }

  return data.user;
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
