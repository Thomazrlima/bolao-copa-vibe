import type { JogoGrupo } from "@/lib/knockout";
import { lookupSportsDbScoreWithRaw } from "@/lib/thesportsdb";

const MAX_PENALTY_LOOKUPS = 4;

export async function enrichMissingPenaltyWinners<T extends JogoGrupo>(jogos: T[]): Promise<T[]> {
  const candidates = jogos.filter(needsPenaltyWinner).slice(0, MAX_PENALTY_LOOKUPS);
  if (candidates.length === 0) return jogos;

  const enriched = new Map<string, T>();

  await Promise.all(
    candidates.map(async (jogo) => {
      if (!jogo.sportsdb_event_id) return;

      try {
        const score = (await lookupSportsDbScoreWithRaw(jogo.sportsdb_event_id)).data;
        if (!score) return;

        const vencedor =
          score.vencedor === "home"
            ? jogo.time1
            : score.vencedor === "away"
              ? jogo.time2
              : jogo.vencedor;

        if (!vencedor && score.penaltis1 == null && score.penaltis2 == null) return;

        enriched.set(jogo.id, {
          ...jogo,
          gols1: score.gols1 ?? jogo.gols1,
          gols2: score.gols2 ?? jogo.gols2,
          penaltis1: score.penaltis1 ?? jogo.penaltis1,
          penaltis2: score.penaltis2 ?? jogo.penaltis2,
          vencedor,
          encerrado: jogo.encerrado || score.encerrado,
          placar_status: score.encerrado ? "finished" : jogo.placar_status,
        });
      } catch {
        // A tela continua com os dados do banco se o provedor externo falhar.
      }
    }),
  );

  if (enriched.size === 0) return jogos;
  return jogos.map((jogo) => enriched.get(jogo.id) ?? jogo);
}

function needsPenaltyWinner(jogo: JogoGrupo) {
  return (
    jogo.fase_id > 1 &&
    jogo.encerrado &&
    jogo.gols1 != null &&
    jogo.gols2 != null &&
    jogo.gols1 === jogo.gols2 &&
    !jogo.vencedor &&
    jogo.sportsdb_event_id != null
  );
}
