import type { SupabaseClient, User } from "@supabase/supabase-js";

import { calcularPontuacaoJogo, type GuessOutcome } from "@/lib/scoring";

type RankingUsuarioRow = {
  id: string;
  nome_completo: string;
  avatar_url?: string | null;
  pontos: number;
  chineladas: number;
};

type UsuarioRow = RankingUsuarioRow & {
  email: string;
  telefone: string;
  created_at: string;
  updated_at: string;
};

type ProfileBadgeKey = "mae-dina" | "no-cangote" | "podio-e-podio" | "lanterna" | "chinelada";

type PalpiteRow = {
  user_id?: string;
  jogo_id: string;
  fase_id: number;
  time1: string;
  time2: string;
  gols1: number;
  gols2: number;
  pontos?: number | null;
  chinelada?: boolean | null;
  calculado_em?: string | null;
  criado_em: string;
};

type JogoRow = {
  id: string;
  fase_id: number;
  time1: string;
  time2: string;
  data: string;
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
  placar_status?: "upcoming" | "live" | "finished" | null;
  transmissao_url?: string | null;
};

type FaseRow = {
  id: number;
  nome: string;
};

export type UsuarioUpdateInput = {
  nome_completo?: string;
  telefone?: string;
  avatar_url?: string | null;
};

export class ServiceError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
  }
}

function assertNoError(error: { message: string } | null | undefined) {
  if (error) throw new ServiceError(error.message);
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

export async function getRankingUsuarios(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("ranking_usuarios")
    .select("id,nome_completo,pontos,chineladas")
    .order("pontos", { ascending: false })
    .order("chineladas", { ascending: false })
    .order("nome_completo", { ascending: true });

  assertNoError(error);

  const ranking = (data ?? []) as RankingUsuarioRow[];
  const avatarPaths = await getUsuarioAvatarPaths(
    supabase,
    ranking.map((usuario) => usuario.id),
  );

  return ranking.map((usuario) => ({
    ...usuario,
    avatar_url: avatarPaths.get(usuario.id) ?? null,
  }));
}

export async function recalcularRankingCompleto(supabase: SupabaseClient) {
  const rpcResult = await supabase.rpc("recalcular_ranking_completo");

  if (!rpcResult.error) {
    const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;

    return {
      jogos_recalculados: Number(row?.jogos_recalculados ?? 0),
      usuarios_atualizados: Number(row?.usuarios_atualizados ?? 0),
    };
  }

  const { data: jogos, error: jogosError } = await supabase
    .from("jogos")
    .select("id")
    .eq("encerrado", true)
    .order("data", { ascending: true });

  assertNoError(jogosError);

  let usuariosAtualizados = 0;

  for (const jogo of jogos ?? []) {
    const { data, error } = await supabase.rpc("recalcular_pontuacao_jogo", {
      p_jogo_id: jogo.id,
    });

    assertNoError(error);

    const row = Array.isArray(data) ? data[0] : data;
    usuariosAtualizados = Number(row?.usuarios_atualizados ?? usuariosAtualizados);
  }

  return {
    jogos_recalculados: jogos?.length ?? 0,
    usuarios_atualizados: usuariosAtualizados,
  };
}

export async function getUsuarioMe(supabase: SupabaseClient, userId: string) {
  const [{ data, error }, avatarPaths] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id,email,nome_completo,telefone,pontos,chineladas,created_at,updated_at")
      .eq("id", userId)
      .single(),
    getUsuarioAvatarPaths(supabase, [userId]),
  ]);

  assertNoError(error);

  return {
    ...(data as Omit<UsuarioRow, "avatar_url">),
    avatar_url: avatarPaths.get(userId) ?? null,
  };
}

export async function updateUsuarioMe(
  supabase: SupabaseClient,
  userId: string,
  payload: UsuarioUpdateInput,
) {
  const { avatar_url: avatarPath, ...usuarioPayload } = payload;

  if (Object.keys(usuarioPayload).length > 0) {
    const { error, count } = await supabase
      .from("usuarios")
      .update(usuarioPayload, { count: "exact" })
      .eq("id", userId);

    assertNoError(error);

    if (count === 0) {
      throw new ServiceError(
        "Seu perfil não pôde ser atualizado. Verifique as políticas de acesso da tabela usuarios.",
        403,
      );
    }
  }

  if (avatarPath !== undefined) {
    await updateUsuarioAvatarPath(supabase, userId, avatarPath);
  }

  return getUsuarioMe(supabase, userId);
}

async function updateUsuarioAvatarPath(
  supabase: SupabaseClient,
  userId: string,
  avatarPath: string | null,
) {
  const { data: existingProfile, error: selectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    console.error("Falha ao consultar o perfil antes de salvar o avatar:", selectError);
    throw new ServiceError(
      "Não foi possível acessar seu perfil para salvar a foto. Verifique as políticas da tabela profiles.",
      403,
    );
  }

  if (existingProfile) {
    const { error, count } = await supabase
      .from("profiles")
      .update(
        {
          avatar_path: avatarPath,
          updated_at: new Date().toISOString(),
        },
        { count: "exact" },
      )
      .eq("id", userId);

    if (error) {
      console.error("Falha ao atualizar o caminho do avatar:", error);
      throw new ServiceError(
        "Não foi possível atualizar a foto no perfil. Verifique a política de UPDATE da tabela profiles.",
        403,
      );
    }

    if (count === 0) {
      throw new ServiceError(
        "A atualização da foto foi bloqueada pela política de acesso da tabela profiles.",
        403,
      );
    }

    return;
  }

  const { error } = await supabase.from("profiles").insert({
    id: userId,
    avatar_path: avatarPath,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Falha ao criar o perfil com o caminho do avatar:", error);
    throw new ServiceError(
      "Não foi possível criar o perfil para salvar a foto. Verifique a política de INSERT da tabela profiles.",
      403,
    );
  }
}

export async function updateAuthenticatedUserPassword(
  supabase: SupabaseClient,
  email: string,
  currentPassword: string,
  newPassword: string,
) {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (signInError) {
    throw new ServiceError("Senha atual inválida.", 400);
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  assertNoError(error);
}

export async function getPerfilUsuario(
  supabase: SupabaseClient,
  requestedId: string,
  authUser: User | null,
) {
  const id = requestedId === "me" ? authUser?.id : requestedId;

  if (!id) {
    throw new ServiceError("Não autenticado.", 401);
  }

  const [
    { data: profile, error: profileError },
    phasesResult,
    { data: rankingRows, error: rankingError },
  ] = await Promise.all([
    supabase
      .from("ranking_usuarios")
      .select("id,nome_completo,pontos,chineladas")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("fases").select("id,nome"),
    supabase
      .from("ranking_usuarios")
      .select("id,nome_completo,pontos,chineladas")
      .order("pontos", { ascending: false })
      .order("chineladas", { ascending: false })
      .order("nome_completo", { ascending: true }),
  ]);

  assertNoError(profileError);
  assertNoError(phasesResult.error);
  assertNoError(rankingError);

  if (!profile) {
    throw new ServiceError("Participante não encontrado.", 404);
  }

  const profileRow = profile as RankingUsuarioRow;
  const ranking = (rankingRows ?? []) as RankingUsuarioRow[];
  const avatarPaths = await getUsuarioAvatarPaths(supabase, [id]);
  const badges = getProfileBadges(profileRow.id, ranking);
  const guesses = await getPalpitesPerfil(supabase, id, {
    expectRows: profileRow.pontos > 0 || profileRow.chineladas > 0,
  });
  const gameIds = [...new Set(guesses.map((guess) => guess.jogo_id))];
  const games = await getJogosPorIds(supabase, gameIds);
  const gameById = new Map(games.map((game) => [game.id, game]));
  const phaseById = new Map(
    ((phasesResult.data ?? []) as FaseRow[]).map((phase) => [phase.id, phase.nome]),
  );
  const stats = emptyStats();

  const palpites = guesses
    .map((guess) => {
      const game = gameById.get(guess.jogo_id);
      const gameStarted = game ? new Date(game.data).getTime() <= nowAsStoredBrasiliaMs() : false;
      const gameIsLive = Boolean(
        game && !game.encerrado && (game.placar_status === "live" || gameStarted),
      );
      const scoring = game
        ? calcularPontuacaoJogo(
            {
              id: game.id,
              gols1: game.gols1,
              gols2: game.gols2,
              encerrado: game.encerrado,
            },
            {
              user_id: id,
              jogo_id: guess.jogo_id,
              gols1: guess.gols1,
              gols2: guess.gols2,
            },
          )
        : null;

      const outcome = getGuessOutcome(guess, game?.encerrado ? scoring?.outcome : null);
      const pontos = getGuessPoints(guess, game?.encerrado ? scoring?.pontos : null);

      if (outcome && (game?.encerrado || hasStoredScore(guess))) {
        stats[outcome] += 1;
      }

      return {
        jogo_id: guess.jogo_id,
        fase: phaseById.get(game?.fase_id ?? guess.fase_id) ?? "Copa do Mundo",
        time1: game?.time1 ?? guess.time1,
        time2: game?.time2 ?? guess.time2,
        data: game?.data ?? guess.criado_em,
        palpite: { gols1: guess.gols1, gols2: guess.gols2 },
        encerrado: game?.encerrado ?? false,
        iniciado: gameIsLive,
        resultado:
          game && game.gols1 != null && game.gols2 != null
            ? { gols1: game.gols1, gols2: game.gols2 }
            : null,
        pontos,
        outcome,
      };
    })
    .sort((a, b) => b.data.localeCompare(a.data));
  if (palpites.length === 0 && profileRow.chineladas > 0) {
    stats.chinelada = profileRow.chineladas;
  }

  return {
    ...profileRow,
    avatar_url: avatarPaths.get(id) ?? null,
    is_current_user: authUser?.id === id,
    badges,
    estatisticas: stats,
    palpites,
  };
}

export async function getPalpitesDoJogo(supabase: SupabaseClient, jogoId: string) {
  const [{ data: jogo, error: jogoError }, guessesResult] = await Promise.all([
    supabase
      .from("jogos")
      .select("id,fase_id,time1,time2,data,gols1,gols2,encerrado,placar_status,transmissao_url")
      .eq("id", jogoId)
      .maybeSingle(),
    supabase.rpc("listar_palpites_jogo", { p_jogo_id: jogoId }),
  ]);

  assertNoError(jogoError);
  let guessesError = guessesResult.error;
  let guesses = (guessesResult.data ?? []) as Required<PalpiteRow>[];

  if (guessesError) {
    const fallback = await supabase
      .from("palpites")
      .select(
        "user_id,jogo_id,fase_id,time1,time2,gols1,gols2,pontos,chinelada,calculado_em,criado_em",
      )
      .eq("jogo_id", jogoId)
      .order("criado_em", { ascending: false });

    guessesError = fallback.error;
    guesses = (fallback.data ?? []) as Required<PalpiteRow>[];
  }

  assertNoError(guessesError);

  if (!jogo) {
    throw new ServiceError("Jogo não encontrado.", 404);
  }

  const userIds = [...new Set(guesses.map((guess) => guess.user_id))];
  const users = await getRankingUsuariosPorIds(supabase, userIds);
  const userById = new Map(users.map((user) => [user.id, user]));
  const game = jogo as JogoRow;

  return {
    jogo: game,
    palpites: guesses
      .map((guess) => {
        const scoring = calcularPontuacaoJogo(game, {
          user_id: guess.user_id,
          jogo_id: guess.jogo_id,
          gols1: guess.gols1,
          gols2: guess.gols2,
        });
        const user = userById.get(guess.user_id);

        return {
          user_id: guess.user_id,
          nome_completo: user?.nome_completo ?? "Participante",
          avatar_url: user?.avatar_url ?? null,
          palpite: { gols1: guess.gols1, gols2: guess.gols2 },
          pontos: getGuessPoints(guess, game.encerrado ? scoring.pontos : null),
          outcome: getGuessOutcome(guess, game.encerrado ? scoring.outcome : null),
          chinelada: game.encerrado ? scoring.chinelada : (guess.chinelada ?? false),
          criado_em: guess.criado_em,
        };
      })
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo)),
  };
}

async function getPalpitesPerfil(
  supabase: SupabaseClient,
  userId: string,
  options: { expectRows: boolean },
) {
  const rpcResult = await supabase.rpc("listar_palpites_perfil", { p_user_id: userId });

  if (!rpcResult.error) {
    return (rpcResult.data ?? []) as PalpiteRow[];
  }

  const { data, error } = await supabase
    .from("palpites")
    .select("jogo_id,fase_id,time1,time2,gols1,gols2,pontos,chinelada,calculado_em,criado_em")
    .eq("user_id", userId)
    .order("criado_em", { ascending: false });

  assertNoError(error);

  const fallbackRows = (data ?? []) as PalpiteRow[];

  if (fallbackRows.length === 0 && options.expectRows) {
    throw new ServiceError(
      "Não foi possível ler os palpites deste perfil. Aplique a migration de leitura pública de palpites no Supabase para liberar SELECT público na tabela palpites.",
      500,
    );
  }

  return fallbackRows;
}

function hasStoredScore(guess: PalpiteRow) {
  return Boolean(guess.calculado_em || guess.chinelada || (guess.pontos ?? 0) > 0);
}

function getGuessOutcome(guess: PalpiteRow, calculatedOutcome: GuessOutcome | null | undefined) {
  if (calculatedOutcome) return calculatedOutcome;
  if (!hasStoredScore(guess)) return null;
  if (guess.chinelada) return "chinelada";

  switch (guess.pontos) {
    case 7:
      return "strong";
    case 5:
      return "result";
    case 2:
      return "goals";
    default:
      return "miss";
  }
}

function getGuessPoints(guess: PalpiteRow, calculatedPoints: number | null | undefined) {
  if (calculatedPoints != null) return calculatedPoints;
  if (!hasStoredScore(guess)) return null;

  return guess.pontos ?? 0;
}

function getProfileBadges(userId: string, ranking: RankingUsuarioRow[]): ProfileBadgeKey[] {
  const badges: ProfileBadgeKey[] = [];
  const position = ranking.findIndex((row) => row.id === userId) + 1;

  if (position === 1) badges.push("mae-dina");
  if (position === 2) badges.push("no-cangote");
  if (position === 3) badges.push("podio-e-podio");
  if (ranking.length > 0 && position === ranking.length) badges.push("lanterna");

  const highestChineladas = Math.max(...ranking.map((row) => row.chineladas));
  const chineladaLeaders = ranking.filter((row) => row.chineladas === highestChineladas);
  if (highestChineladas > 0 && chineladaLeaders.length === 1 && chineladaLeaders[0].id === userId) {
    badges.push("chinelada");
  }

  return badges;
}

async function getJogosPorIds(supabase: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("jogos")
    .select("id,fase_id,time1,time2,data,gols1,gols2,encerrado,placar_status")
    .in("id", ids);

  assertNoError(error);

  return (data ?? []) as JogoRow[];
}

async function getRankingUsuariosPorIds(supabase: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return [];

  const [{ data, error }, avatarPaths] = await Promise.all([
    supabase.from("ranking_usuarios").select("id,nome_completo,pontos,chineladas").in("id", ids),
    getUsuarioAvatarPaths(supabase, ids),
  ]);

  assertNoError(error);

  return ((data ?? []) as RankingUsuarioRow[]).map((usuario) => ({
    ...usuario,
    avatar_url: avatarPaths.get(usuario.id) ?? null,
  }));
}

async function getUsuarioAvatarPaths(supabase: SupabaseClient, ids: string[]) {
  const avatarPaths = new Map<string, string | null>();

  if (ids.length === 0) return avatarPaths;

  const { data, error } = await supabase.from("profiles").select("id,avatar_path").in("id", ids);

  if (error) {
    console.error("Não foi possível carregar os avatares dos usuários:", error);
    return avatarPaths;
  }

  for (const usuario of data ?? []) {
    avatarPaths.set(usuario.id, usuario.avatar_path);
  }

  return avatarPaths;
}

function emptyStats(): Record<GuessOutcome, number> {
  return {
    chinelada: 0,
    strong: 0,
    result: 0,
    goals: 0,
    miss: 0,
  };
}
