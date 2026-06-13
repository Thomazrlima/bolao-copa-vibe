import { NextResponse } from "next/server";

import { canManageUsers } from "@/lib/admin-users";
import { createAdminClient, hasAdminCredentials } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type GameRow = {
  id: string;
  fase_id: number;
  time1: string;
  time2: string;
  data: string;
  encerrado: boolean;
  transmissao_url: string | null;
};

type UserRow = {
  id: string;
  nome_completo: string;
  email: string;
};

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { error: "A credencial administrativa do Supabase não está configurada." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const [usersResult, gamesResult, highlightsResult, syncResult] = await Promise.all([
    admin.from("usuarios").select("id,nome_completo,email").order("nome_completo"),
    admin
      .from("jogos")
      .select("id,fase_id,time1,time2,data,encerrado,transmissao_url")
      .order("data"),
    admin.from("transmissao_destaques").select("slot,jogo_id").order("slot"),
    admin
      .from("sync_jogos_estado")
      .select(
        "bloqueado_ate,ultima_tentativa,ultimo_sucesso,ultimo_erro,jogos_elegiveis,jogos_sincronizados,duracao_ms",
      )
      .eq("id", true)
      .maybeSingle(),
  ]);

  const firstError =
    usersResult.error ?? gamesResult.error ?? highlightsResult.error ?? syncResult.error;
  if (firstError) {
    return NextResponse.json(
      { error: `Não foi possível carregar a administração: ${firstError.message}` },
      { status: 500 },
    );
  }

  const users = (usersResult.data ?? []) as UserRow[];
  const games = (gamesResult.data ?? []) as GameRow[];
  const now = nowAsStoredBrasiliaMs();
  const deadline = now + 24 * 60 * 60 * 1000;
  const urgentGames = games.filter((game) => {
    const startsAt = new Date(game.data).getTime();
    return !game.encerrado && startsAt > now && startsAt <= deadline;
  });

  const urgentGameIds = urgentGames.map((game) => game.id);
  const guessesResult = urgentGameIds.length
    ? await admin.from("palpites").select("user_id,jogo_id").in("jogo_id", urgentGameIds)
    : { data: [], error: null };

  if (guessesResult.error) {
    return NextResponse.json(
      { error: `Não foi possível carregar os palpites: ${guessesResult.error.message}` },
      { status: 500 },
    );
  }

  const guessed = new Set(
    (guessesResult.data ?? []).map((guess) => `${guess.user_id}:${guess.jogo_id}`),
  );
  const pendingUsers = users
    .map((user) => ({
      ...user,
      jogos_pendentes: urgentGames.filter((game) => !guessed.has(`${user.id}:${game.id}`)),
    }))
    .filter((user) => user.jogos_pendentes.length > 0);

  const highlightBySlot = new Map(
    (highlightsResult.data ?? []).map((highlight) => [highlight.slot, highlight.jogo_id]),
  );

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    pending_users: pendingUsers,
    urgent_games: urgentGames,
    games,
    sync_status: syncResult.data ?? null,
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
