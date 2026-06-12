import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { lookupSportsDbScore } from "@/lib/thesportsdb";
import { lookupWorldCup2026Scores } from "@/lib/worldcup2026";

type JogoSync = {
  id: string;
  sportsdb_event_id: string | null;
  worldcup2026_game_id: string | null;
  data: string;
  encerrado: boolean;
};

function nowAsStoredBrasiliaIso() {
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

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`;
}

export async function POST() {
  const supabase = await createClient();
  const nowIso = nowAsStoredBrasiliaIso();

  const { data: jogos, error } = await supabase
    .from("jogos")
    .select("id,sportsdb_event_id,worldcup2026_game_id,data,encerrado")
    .lte("data", nowIso)
    .eq("encerrado", false)
    .order("data", { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const synced = [];
  const recalculated = [];
  const syncableJogos = ((jogos ?? []) as JogoSync[]).filter(
    (jogo) => jogo.worldcup2026_game_id || jogo.sportsdb_event_id,
  );
  const shouldUseWorldCup2026 = syncableJogos.some((jogo) => jogo.worldcup2026_game_id);
  const worldCupScores = shouldUseWorldCup2026
    ? await lookupWorldCup2026Scores().catch(() => null)
    : null;

  for (const jogo of syncableJogos) {
    if (jogo.worldcup2026_game_id && worldCupScores) {
      const score = worldCupScores.get(jogo.worldcup2026_game_id);

      if (score) {
        const { data: updated, error: updateError } = await supabase.rpc(
          "atualizar_placar_jogo_worldcup2026",
          {
            p_worldcup2026_game_id: score.gameId,
            p_gols1: score.gols1,
            p_gols2: score.gols2,
            p_placar_status: score.placarStatus,
            p_status_origem: score.statusOrigem,
          },
        );

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        synced.push(updated);
        if (score.placarStatus === "finished") recalculated.push(score.gameId);
        continue;
      }
    }

    if (!jogo.sportsdb_event_id) continue;

    const score = await lookupSportsDbScore(jogo.sportsdb_event_id);
    if (!score) continue;

    const { data: updated, error: updateError } = await supabase.rpc(
      "atualizar_placar_jogo_sportsdb",
      {
        p_sportsdb_event_id: score.eventId,
        p_gols1: score.gols1,
        p_gols2: score.gols2,
        p_encerrado: score.encerrado,
        p_status: score.status,
      },
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    synced.push(updated);
    if (score.encerrado) {
      const jogoId = Array.isArray(updated) ? updated[0]?.id : updated?.id;
      if (jogoId) {
        const { error: rankingError } = await supabase.rpc("recalcular_pontuacao_jogo", {
          p_jogo_id: jogoId,
        });

        if (rankingError) {
          return NextResponse.json({ error: rankingError.message }, { status: 500 });
        }
      }
      recalculated.push(score.eventId);
    }
  }

  return NextResponse.json({ synced, recalculated });
}
