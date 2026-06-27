import type { SupabaseClient } from "@supabase/supabase-js";

import { calcularPontuacaoJogo, type GuessOutcome } from "@/lib/scoring";
import { ServiceError } from "@/lib/server/bolao-service";

type JogoRow = {
  id: string;
  fase_id: number;
  time1: string;
  time2: string;
  data: string;
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
  rodada: number | null;
  placar_status: "upcoming" | "live" | "finished" | null;
  sportsdb_status: string | null;
};

type PalpiteRow = {
  user_id: string;
  jogo_id: string;
  gols1: number;
  gols2: number;
  pontos: number | null;
  chinelada: boolean | null;
  calculado_em: string | null;
  criado_em: string;
};

type RankingRow = {
  id: string;
  nome_completo: string;
  pontos: number;
  chineladas: number;
};

type FaseRow = {
  id: number;
  nome: string;
};

type GrupoRow = {
  grupo: string;
  time: string;
};

const OUTCOMES: GuessOutcome[] = ["chinelada", "strong", "result", "goals", "miss"];

function canShowPublicGuesses(
  game: Pick<JogoRow, "fase_id" | "encerrado" | "placar_status"> | undefined,
) {
  if (!game) return true;
  const isProtectedKnockoutGame = game.fase_id > 1 && game.fase_id !== 6;
  return !isProtectedKnockoutGame || game.encerrado || game.placar_status === "live";
}

export async function getPalpitesDashboard(supabase: SupabaseClient, userId: string) {
  const [gamesResult, guessesResult, phasesResult, rankingResult, groupsResult] = await Promise.all(
    [
      supabase
        .from("jogos")
        .select(
          "id,fase_id,time1,time2,data,gols1,gols2,encerrado,rodada,placar_status,sportsdb_status",
        )
        .order("data", { ascending: true }),
      supabase
        .from("palpites")
        .select("user_id,jogo_id,gols1,gols2,pontos,chinelada,calculado_em,criado_em"),
      supabase.from("fases").select("id,nome"),
      supabase
        .from("ranking_usuarios")
        .select("id,nome_completo,pontos,chineladas")
        .order("pontos", { ascending: false })
        .order("chineladas", { ascending: false }),
      supabase.from("grupos").select("grupo,time"),
    ],
  );

  assertNoError(gamesResult.error);
  assertNoError(guessesResult.error);
  assertNoError(phasesResult.error);
  assertNoError(rankingResult.error);
  assertNoError(groupsResult.error);

  const games = (gamesResult.data ?? []) as JogoRow[];
  const publicGuesses = (guessesResult.data ?? []) as PalpiteRow[];
  const userGuesses = await getPalpitesDoUsuario(supabase, userId);
  const phases = (phasesResult.data ?? []) as FaseRow[];
  const ranking = (rankingResult.data ?? []) as RankingRow[];
  const groups = (groupsResult.data ?? []) as GrupoRow[];
  const phaseById = new Map(phases.map((phase) => [phase.id, phase.nome]));
  const groupByTeam = new Map(groups.map((group) => [group.time, group.grupo]));
  const gameById = new Map(games.map((game) => [game.id, game]));
  const visiblePublicGuesses = publicGuesses.filter((guess) =>
    canShowPublicGuesses(gameById.get(guess.jogo_id)),
  );
  const guesses = [
    ...visiblePublicGuesses.filter((guess) => guess.user_id !== userId),
    ...userGuesses,
  ];
  const myGuessByGame = new Map(
    guesses.filter((guess) => guess.user_id === userId).map((guess) => [guess.jogo_id, guess]),
  );
  const now = nowAsStoredBrasiliaMs();

  const mappedGames = games.map((game) => {
    const guess = myGuessByGame.get(game.id);
    const scoring = guess && game.encerrado ? scoreGuess(game, guess) : null;

    return {
      id: game.id,
      fase_id: game.fase_id,
      fase: phaseById.get(game.fase_id) ?? "Copa do Mundo",
      grupo: game.fase_id === 1 ? (groupByTeam.get(game.time1) ?? null) : null,
      rodada: game.rodada,
      time1: game.time1,
      time2: game.time2,
      data: game.data,
      gols1: game.gols1,
      gols2: game.gols2,
      encerrado: game.encerrado,
      iniciado: new Date(game.data).getTime() <= now,
      ao_vivo: !game.encerrado && game.placar_status === "live",
      placar_status: game.placar_status,
      sportsdb_status: game.sportsdb_status,
      palpite: guess ? { gols1: guess.gols1, gols2: guess.gols2 } : null,
      pontos: scoring?.pontos ?? (game.encerrado ? (guess?.pontos ?? null) : null),
      outcome: scoring?.outcome ?? null,
    };
  });

  const finishedGuesses = guesses.flatMap((guess) => {
    const game = gameById.get(guess.jogo_id);
    if (!game?.encerrado) return [];
    return [{ guess, game, scoring: scoreGuess(game, guess) }];
  });
  const myFinished = finishedGuesses.filter(({ guess }) => guess.user_id === userId);
  const myAccuracyGuesses = myFinished.filter(({ scoring }) => isAccuracyEligible(scoring.outcome));
  const myOpen = mappedGames.filter((game) => !game.encerrado);
  const currentUser = ranking.find((participant) => participant.id === userId);
  const position = ranking.findIndex((participant) => participant.id === userId) + 1;

  const outcomeDistribution = OUTCOMES.map((outcome) => ({
    outcome,
    count: finishedGuesses.filter(({ scoring }) => scoring.outcome === outcome).length,
  }));
  const roundAccuracy = buildRoundAccuracy(games, finishedGuesses, userId, phaseById);
  const pointsEvolution = buildPointsEvolution(myFinished);
  const popularGame = games.find((game) => !game.encerrado && new Date(game.data).getTime() > now);
  const popularGuesses = buildPopularGuesses(guesses);

  return {
    jogos: mappedGames,
    resumo: {
      feitos: myOpen.filter((game) => game.palpite).length,
      pendentes: myOpen.filter((game) => !game.iniciado && !game.palpite).length,
      pontos: currentUser?.pontos ?? 0,
      posicao: position || null,
    },
    geral: {
      participantes: new Set(guesses.map((guess) => guess.user_id)).size,
      palpites: guesses.length,
      chineladas: finishedGuesses.filter(({ scoring }) => scoring.outcome === "chinelada").length,
      media_pontos:
        finishedGuesses.length > 0
          ? finishedGuesses.reduce((sum, item) => sum + item.scoring.pontos, 0) /
            finishedGuesses.length
          : 0,
      outcomes: outcomeDistribution,
      rodadas: roundAccuracy,
      jogo_popular: popularGame
        ? { id: popularGame.id, time1: popularGame.time1, time2: popularGame.time2 }
        : null,
      palpites_populares: popularGuesses,
    },
    pessoal: {
      nome: currentUser?.nome_completo ?? "Participante",
      posicao: position || null,
      pontos: currentUser?.pontos ?? 0,
      chineladas: currentUser?.chineladas ?? 0,
      encerrados: myAccuracyGuesses.length,
      acertos: myAccuracyGuesses.filter(({ scoring }) => isAccuracyHit(scoring.outcome)).length,
      outcomes: OUTCOMES.map((outcome) => ({
        outcome,
        count: myFinished.filter(({ scoring }) => scoring.outcome === outcome).length,
      })),
      evolucao: pointsEvolution,
    },
  };
}

export async function upsertPalpite(
  supabase: SupabaseClient,
  userId: string,
  jogoId: string,
  gols1: number,
  gols2: number,
) {
  const { data: jogo, error: jogoError } = await supabase
    .from("jogos")
    .select("id,fase_id,time1,time2,data,encerrado")
    .eq("id", jogoId)
    .maybeSingle();

  assertNoError(jogoError);

  if (!jogo) throw new ServiceError("Jogo não encontrado.", 404);
  if (jogo.encerrado || new Date(jogo.data).getTime() <= nowAsStoredBrasiliaMs()) {
    throw new ServiceError("O prazo para palpitar neste jogo já encerrou.", 409);
  }

  const { data, error } = await supabase
    .from("palpites")
    .upsert(
      {
        user_id: userId,
        jogo_id: jogo.id,
        fase_id: jogo.fase_id,
        time1: jogo.time1,
        time2: jogo.time2,
        gols1,
        gols2,
      },
      { onConflict: "user_id,jogo_id" },
    )
    .select("jogo_id,gols1,gols2,criado_em")
    .single();

  assertNoError(error);
  return data;
}

function scoreGuess(game: JogoRow, guess: PalpiteRow) {
  return calcularPontuacaoJogo(
    {
      id: game.id,
      fase_id: game.fase_id,
      gols1: game.gols1,
      gols2: game.gols2,
      encerrado: game.encerrado,
    },
    {
      user_id: guess.user_id,
      jogo_id: guess.jogo_id,
      gols1: guess.gols1,
      gols2: guess.gols2,
    },
  );
}

function buildRoundAccuracy(
  games: JogoRow[],
  finishedGuesses: Array<{
    guess: PalpiteRow;
    game: JogoRow;
    scoring: ReturnType<typeof scoreGuess>;
  }>,
  userId: string,
  phaseById: Map<number, string>,
) {
  const labels = new Map(
    games.map((game) => [
      game.id,
      game.rodada
        ? `R${game.rodada}`
        : game.fase_id > 1
          ? "MATA-MATA"
          : (phaseById.get(game.fase_id) ?? "Copa"),
    ]),
  );
  const grouped = new Map<
    string,
    { total: number; correct: number; userTotal: number; userCorrect: number }
  >();

  finishedGuesses.forEach(({ guess, game, scoring }) => {
    if (!isAccuracyEligible(scoring.outcome)) return;

    const label = labels.get(game.id) ?? "Copa";
    const row = grouped.get(label) ?? { total: 0, correct: 0, userTotal: 0, userCorrect: 0 };
    row.total += 1;
    if (isAccuracyHit(scoring.outcome)) row.correct += 1;
    if (guess.user_id === userId) {
      row.userTotal += 1;
      if (isAccuracyHit(scoring.outcome)) row.userCorrect += 1;
    }
    grouped.set(label, row);
  });

  return [...grouped.entries()]
    .map(([round, row]) => ({
      round,
      geral: percentage(row.correct, row.total),
      voce: percentage(row.userCorrect, row.userTotal),
    }))
    .sort((a, b) => roundAccuracyOrder(a.round) - roundAccuracyOrder(b.round));
}

function isAccuracyEligible(outcome: GuessOutcome) {
  return outcome !== "goals";
}

function isAccuracyHit(outcome: GuessOutcome) {
  return outcome !== "miss" && outcome !== "goals";
}

function roundAccuracyOrder(round: string) {
  const groupRound = round.match(/^R(\d+)$/i);
  if (groupRound) return Number(groupRound[1]);
  if (round === "MATA-MATA") return 100;
  return 200;
}

function buildPointsEvolution(
  guesses: Array<{ guess: PalpiteRow; game: JogoRow; scoring: ReturnType<typeof scoreGuess> }>,
) {
  let points = 0;

  return guesses
    .sort((a, b) => a.game.data.localeCompare(b.game.data))
    .map((item, index) => {
      points += item.scoring.pontos;
      return { game: `J${index + 1}`, points };
    });
}

function buildPopularGuesses(guesses: PalpiteRow[]) {
  const grouped = new Map<string, number>();
  guesses.forEach((guess) => {
    const score = `${guess.gols1} x ${guess.gols2}`;
    grouped.set(score, (grouped.get(score) ?? 0) + 1);
  });

  return [...grouped.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([score, count]) => ({
      score,
      count,
      percent: percentage(count, guesses.length),
    }));
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function assertNoError(error: { message: string } | null | undefined) {
  if (error) throw new ServiceError(error.message);
}

async function getPalpitesDoUsuario(supabase: SupabaseClient, userId: string) {
  const rpcResult = await supabase.rpc("listar_palpites_perfil", { p_user_id: userId });

  if (!rpcResult.error) {
    return ((rpcResult.data ?? []) as Omit<PalpiteRow, "user_id">[]).map((guess) => ({
      ...guess,
      user_id: userId,
    }));
  }

  const { data, error } = await supabase
    .from("palpites")
    .select("user_id,jogo_id,gols1,gols2,pontos,chinelada,calculado_em,criado_em")
    .eq("user_id", userId);

  assertNoError(error);
  return (data ?? []) as PalpiteRow[];
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
