import { NextResponse } from "next/server";

import { calcularPontuacaoJogo, type GuessOutcome } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";

type PalpiteRow = {
  jogo_id: string;
  fase_id: number;
  time1: string;
  time2: string;
  gols1: number;
  gols2: number;
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
};

const EMPTY_STATS: Record<GuessOutcome, number> = {
  chinelada: 0,
  strong: 0,
  result: 0,
  goals: 0,
  miss: 0,
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: auth }, profileResult, guessesResult, phasesResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("ranking_usuarios")
      .select("id,nome_completo,pontos,chineladas")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("palpites")
      .select("jogo_id,fase_id,time1,time2,gols1,gols2,criado_em")
      .eq("user_id", id)
      .order("criado_em", { ascending: false }),
    supabase.from("fases").select("id,nome"),
  ]);

  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error.message }, { status: 500 });
  }

  if (!profileResult.data) {
    return NextResponse.json({ error: "Participante não encontrado." }, { status: 404 });
  }

  if (guessesResult.error) {
    return NextResponse.json({ error: guessesResult.error.message }, { status: 500 });
  }

  const guesses = (guessesResult.data ?? []) as PalpiteRow[];
  const gameIds = guesses.map((guess) => guess.jogo_id);
  let games: JogoRow[] = [];

  if (gameIds.length > 0) {
    const gamesResult = await supabase
      .from("jogos")
      .select("id,fase_id,time1,time2,data,gols1,gols2,encerrado")
      .in("id", gameIds);

    if (gamesResult.error) {
      return NextResponse.json({ error: gamesResult.error.message }, { status: 500 });
    }

    games = (gamesResult.data ?? []) as JogoRow[];
  }

  const gameById = new Map(games.map((game) => [game.id, game]));
  const phaseById = new Map(
    (phasesResult.data ?? []).map((phase) => [phase.id as number, phase.nome as string]),
  );
  const stats = { ...EMPTY_STATS };

  const palpites = guesses
    .map((guess) => {
      const game = gameById.get(guess.jogo_id);
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

      if (game?.encerrado && scoring) stats[scoring.outcome] += 1;

      return {
        jogo_id: guess.jogo_id,
        fase: phaseById.get(game?.fase_id ?? guess.fase_id) ?? "Copa do Mundo",
        time1: game?.time1 ?? guess.time1,
        time2: game?.time2 ?? guess.time2,
        data: game?.data ?? guess.criado_em,
        palpite: { gols1: guess.gols1, gols2: guess.gols2 },
        encerrado: game?.encerrado ?? false,
        resultado:
          game?.encerrado && game.gols1 != null && game.gols2 != null
            ? { gols1: game.gols1, gols2: game.gols2 }
            : null,
        pontos: game?.encerrado ? (scoring?.pontos ?? 0) : null,
        outcome: game?.encerrado ? (scoring?.outcome ?? "miss") : null,
      };
    })
    .sort((a, b) => b.data.localeCompare(a.data));

  return NextResponse.json({
    perfil: {
      ...profileResult.data,
      is_current_user: auth.user?.id === id,
      estatisticas: stats,
      palpites,
    },
  });
}
