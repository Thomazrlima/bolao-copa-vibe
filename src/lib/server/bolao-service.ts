import type { SupabaseClient, User } from "@supabase/supabase-js";

import { teamCodeFromName } from "@/data/iso2";
import { orderStatistics, normalizeStatisticName } from "@/lib/match-statistics";
import { groupStandings, type GrupoRow as KnockoutGrupoRow } from "@/lib/knockout";
import { getRankingBadgeKeys } from "@/lib/ranking-badges";
import { calcularPontuacaoJogo, type GuessOutcome } from "@/lib/scoring";
import { resolveSelectionNameFromSlug, selectionSlugFromName } from "@/lib/selections";

type RankingUsuarioRow = {
  id: string;
  nome_completo: string;
  avatar_url?: string | null;
  pontos: number;
  chineladas: number;
  pontos_oficiais?: number;
  chineladas_oficiais?: number;
  posicao?: number;
  posicao_base?: number;
  variacao?: number;
  movimento?: "partial" | "final" | null;
};

type UsuarioRow = RankingUsuarioRow & {
  email: string;
  telefone: string;
  created_at: string;
  updated_at: string;
};

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
  estatisticas?: Array<{
    name: string;
    home: number | null;
    away: number | null;
  }> | null;
  estatisticas_sincronizadas_em?: string | null;
};

type JogoSelecaoRow = JogoRow & {
  rodada: number | null;
  sportsdb_status?: string | null;
};

type GrupoSelecaoRow = KnockoutGrupoRow & {
  updated_at?: string | null;
};

type FaseRow = {
  id: number;
  nome: string;
};

type PerfilEspeciaisRow = {
  acertos: number;
  pontos: number;
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
  const liveResult = await supabase.rpc("obter_ranking_ao_vivo");
  const fallbackResult = liveResult.error
    ? await supabase
        .from("ranking_usuarios")
        .select("id,nome_completo,pontos,chineladas")
        .order("pontos", { ascending: false })
        .order("chineladas", { ascending: false })
        .order("nome_completo", { ascending: true })
    : null;
  const data = liveResult.error ? fallbackResult?.data : liveResult.data;
  const error = liveResult.error ? fallbackResult?.error : liveResult.error;

  assertNoError(error);

  const ranking = ((data ?? []) as RankingUsuarioRow[]).map((usuario, index) => ({
    ...usuario,
    pontos_oficiais: usuario.pontos_oficiais ?? usuario.pontos,
    chineladas_oficiais: usuario.chineladas_oficiais ?? usuario.chineladas,
    posicao: usuario.posicao ?? index + 1,
    posicao_base: usuario.posicao_base ?? index + 1,
    variacao: usuario.variacao ?? 0,
    movimento: usuario.movimento ?? null,
  }));
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
    specialsResult,
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
    supabase.rpc("pontuacao_especiais_perfil", { p_user_id: id }),
  ]);

  assertNoError(profileError);
  assertNoError(phasesResult.error);
  assertNoError(rankingError);
  assertNoError(specialsResult.error);

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
  const specialsRow = (
    Array.isArray(specialsResult.data) ? specialsResult.data[0] : specialsResult.data
  ) as PerfilEspeciaisRow | null | undefined;

  const palpites = guesses
    .map((guess) => {
      const game = gameById.get(guess.jogo_id);
      const gameStarted = game ? new Date(game.data).getTime() <= nowAsStoredBrasiliaMs() : false;
      const gameIsLive = Boolean(game && !game.encerrado && game.placar_status === "live");
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
        iniciado: gameStarted,
        ao_vivo: gameIsLive,
        resultado:
          game && (game.encerrado || gameIsLive) && game.gols1 != null && game.gols2 != null
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
    especiais: {
      acertos: Number(specialsRow?.acertos ?? 0),
      pontos: Number(specialsRow?.pontos ?? 0),
    },
    palpites,
  };
}

export async function getPalpitesDoJogo(supabase: SupabaseClient, jogoId: string) {
  const [{ data: jogo, error: jogoError }, guessesResult] = await Promise.all([
    supabase
      .from("jogos")
      .select(
        "id,fase_id,time1,time2,data,gols1,gols2,encerrado,placar_status,transmissao_url,estatisticas,estatisticas_sincronizadas_em",
      )
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
  const gameIsLive = !game.encerrado && game.placar_status === "live";
  const shouldCalculateScore = game.encerrado || gameIsLive;

  return {
    jogo: game,
    palpites: guesses
      .map((guess) => {
        const scoring = calcularPontuacaoJogo(
          { ...game, encerrado: shouldCalculateScore },
          {
            user_id: guess.user_id,
            jogo_id: guess.jogo_id,
            gols1: guess.gols1,
            gols2: guess.gols2,
          },
        );
        const user = userById.get(guess.user_id);

        return {
          user_id: guess.user_id,
          nome_completo: user?.nome_completo ?? "Participante",
          avatar_url: user?.avatar_url ?? null,
          palpite: { gols1: guess.gols1, gols2: guess.gols2 },
          pontos: getGuessPoints(guess, shouldCalculateScore ? scoring.pontos : null),
          outcome: getGuessOutcome(guess, shouldCalculateScore ? scoring.outcome : null),
          chinelada: shouldCalculateScore ? scoring.chinelada : (guess.chinelada ?? false),
          criado_em: guess.criado_em,
        };
      })
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo)),
  };
}

export async function getPerfilSelecao(supabase: SupabaseClient, slug: string) {
  const [gruposResult, jogosResult, fasesResult] = await Promise.all([
    supabase
      .from("grupos")
      .select("grupo,time,pontuacao,saldo_gols,gols_pro,gols_contra,updated_at")
      .order("grupo", { ascending: true }),
    supabase
      .from("jogos")
      .select(
        "id,fase_id,time1,time2,data,gols1,gols2,encerrado,rodada,placar_status,sportsdb_status,estatisticas,estatisticas_sincronizadas_em",
      )
      .order("data", { ascending: true }),
    supabase.from("fases").select("id,nome"),
  ]);

  assertNoError(gruposResult.error);
  assertNoError(jogosResult.error);
  assertNoError(fasesResult.error);

  const grupos = (gruposResult.data ?? []) as GrupoSelecaoRow[];
  const jogos = (jogosResult.data ?? []) as JogoSelecaoRow[];
  const fases = (fasesResult.data ?? []) as FaseRow[];
  const teamNames = [
    ...new Set([
      ...grupos.map((grupo) => grupo.time),
      ...jogos.flatMap((jogo) => [jogo.time1, jogo.time2]),
    ]),
  ];
  const selectionName = resolveSelectionNameFromSlug(slug, teamNames);

  if (!selectionName) {
    throw new ServiceError("Seleção não encontrada.", 404);
  }

  const phaseById = new Map(fases.map((fase) => [fase.id, fase.nome]));
  const groupStageGames = jogos.filter((jogo) => jogo.fase_id === 1);
  const standings = groupStandings(grupos, groupStageGames);
  const teamStandingEntry = standings
    .flatMap(({ group, standings: groupStandingsList }) =>
      groupStandingsList.map((standing, index) => ({
        ...standing,
        grupo: group,
        posicao: index + 1,
      })),
    )
    .find((standing) => standing.time === selectionName);
  const teamGames = jogos
    .filter((jogo) => jogo.time1 === selectionName || jogo.time2 === selectionName)
    .sort((a, b) => a.data.localeCompare(b.data));
  const guesses = await getPalpitesParaJogos(supabase, teamGames.map((jogo) => jogo.id));
  const gameById = new Map(teamGames.map((jogo) => [jogo.id, jogo]));
  const confidence = buildSelectionConfidence(selectionName, guesses, gameById);
  const statistics = buildSelectionStatistics(selectionName, teamGames);
  const summary = buildSelectionSummary(selectionName, teamGames);

  return {
    selecao: {
      nome: selectionName,
      slug: selectionSlugFromName(selectionName),
      codigo: teamCodeFromName(selectionName) ?? null,
      grupo:
        teamStandingEntry?.grupo ?? grupos.find((grupo) => grupo.time === selectionName)?.grupo ?? null,
      posicao: teamStandingEntry?.posicao ?? null,
      pontos: teamStandingEntry?.pontuacao ?? null,
      saldo_gols: teamStandingEntry?.saldo_gols ?? null,
      jogos: teamStandingEntry?.jogos ?? null,
    },
    jogos: teamGames.map((jogo) => {
      const isHome = jogo.time1 === selectionName;
      const opponent = isHome ? jogo.time2 : jogo.time1;

      return {
        id: jogo.id,
        fase_id: jogo.fase_id,
        fase: phaseById.get(jogo.fase_id) ?? "Copa do Mundo",
        grupo: jogo.fase_id === 1 ? teamStandingEntry?.grupo ?? null : null,
        rodada: jogo.rodada,
        time1: jogo.time1,
        time2: jogo.time2,
        adversario: opponent,
        selecao_em_casa: isHome,
        data: jogo.data,
        gols1: jogo.gols1,
        gols2: jogo.gols2,
        encerrado: jogo.encerrado,
        placar_status: jogo.placar_status ?? null,
        sportsdb_status: jogo.sportsdb_status ?? null,
      };
    }),
    resumo: summary,
    confianca: confidence,
    estatisticas: statistics,
  };
}

async function getPalpitesParaJogos(supabase: SupabaseClient, gameIds: string[]) {
  if (gameIds.length === 0) return [];

  const results = await Promise.all(
    gameIds.map(async (jogoId) => {
      const rpcResult = await supabase.rpc("listar_palpites_jogo", { p_jogo_id: jogoId });

      if (!rpcResult.error) {
        return (rpcResult.data ?? []) as PalpiteRow[];
      }

      const fallback = await supabase
        .from("palpites")
        .select("jogo_id,fase_id,time1,time2,gols1,gols2,pontos,chinelada,calculado_em,criado_em")
        .eq("jogo_id", jogoId);

      assertNoError(fallback.error);

      return (fallback.data ?? []) as PalpiteRow[];
    }),
  );

  return results.flat();
}

function buildSelectionConfidence(
  selectionName: string,
  guesses: PalpiteRow[],
  gameById: Map<string, JogoSelecaoRow>,
) {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const guess of guesses) {
    const game = gameById.get(guess.jogo_id);
    if (!game) continue;

    const isHome = game.time1 === selectionName;
    const teamGoals = isHome ? guess.gols1 : guess.gols2;
    const opponentGoals = isHome ? guess.gols2 : guess.gols1;

    goalsFor += teamGoals;
    goalsAgainst += opponentGoals;

    if (teamGoals > opponentGoals) wins += 1;
    else if (teamGoals === opponentGoals) draws += 1;
    else losses += 1;
  }

  const total = wins + draws + losses;

  return {
    total_palpites: total,
    vitorias: wins,
    empates: draws,
    derrotas: losses,
    percentual_vitoria: percentage(wins, total),
    percentual_empate: percentage(draws, total),
    percentual_derrota: percentage(losses, total),
    media_gols_pro: average(goalsFor, total),
    media_gols_contra: average(goalsAgainst, total),
  };
}

function buildSelectionSummary(selectionName: string, games: JogoSelecaoRow[]) {
  let disputados = 0;
  let vitorias = 0;
  let empates = 0;
  let derrotas = 0;
  let golsPro = 0;
  let golsContra = 0;

  for (const game of games) {
    const hasScore = game.gols1 != null && game.gols2 != null;
    const finished = game.encerrado || game.placar_status === "finished";

    if (!finished || !hasScore) continue;

    const isHome = game.time1 === selectionName;
    const teamGoals = isHome ? game.gols1! : game.gols2!;
    const opponentGoals = isHome ? game.gols2! : game.gols1!;

    disputados += 1;
    golsPro += teamGoals;
    golsContra += opponentGoals;

    if (teamGoals > opponentGoals) vitorias += 1;
    else if (teamGoals === opponentGoals) empates += 1;
    else derrotas += 1;
  }

  const liveGame = games.find((game) => !game.encerrado && game.placar_status === "live") ?? null;
  const nextGame =
    liveGame ??
    games.find((game) => !game.encerrado && game.placar_status !== "finished") ??
    null;

  return {
    disputados,
    vitorias,
    empates,
    derrotas,
    gols_pro: golsPro,
    gols_contra: golsContra,
    saldo_gols: golsPro - golsContra,
    proximo_jogo_id: nextGame?.id ?? null,
    jogo_ao_vivo_id: liveGame?.id ?? null,
  };
}

function buildSelectionStatistics(selectionName: string, games: JogoSelecaoRow[]) {
  const totals = new Map<
    string,
    {
      name: string;
      total: number;
      jogos: number;
    }
  >();
  let syncedAt = "";

  for (const game of games) {
    const isHome = game.time1 === selectionName;

    if (game.estatisticas_sincronizadas_em) {
      syncedAt =
        syncedAt > game.estatisticas_sincronizadas_em
          ? syncedAt
          : game.estatisticas_sincronizadas_em;
    }

    for (const statistic of game.estatisticas ?? []) {
      const value = isHome ? statistic.home : statistic.away;
      if (value == null) continue;

      const key = normalizeStatisticName(statistic.name);
      const current = totals.get(key) ?? { name: statistic.name, total: 0, jogos: 0 };

      current.total += value;
      current.jogos += 1;
      totals.set(key, current);
    }
  }

  return {
    sincronizado_em: syncedAt || null,
    itens: orderStatistics(
      [...totals.values()].map((statistic) => ({
        ...statistic,
        media: average(statistic.total, statistic.jogos),
      })),
    ),
  };
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : null;
}

function average(value: number, total: number) {
  return total > 0 ? Number((value / total).toFixed(1)) : null;
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

function getProfileBadges(userId: string, ranking: RankingUsuarioRow[]) {
  return getRankingBadgeKeys(userId, ranking);
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
