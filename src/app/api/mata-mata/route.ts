import { NextResponse } from "next/server";

import { buildKnockoutBracket, type GrupoRow, type JogoGrupo } from "@/lib/knockout";
import { enrichMissingPenaltyWinners } from "@/lib/server/knockout-penalty-enrichment";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const [gruposResult, jogosResult] = await Promise.all([
    supabase
      .from("grupos")
      .select("grupo,time,pontuacao,saldo_gols,gols_pro,gols_contra")
      .order("grupo", { ascending: true }),
    supabase
      .from("jogos")
      .select(
        "id,sportsdb_event_id,fase_id,codigo_mata_mata,time1,time2,data,gols1,gols2,penaltis1,penaltis2,vencedor,encerrado,rodada,placar_status",
      )
      .order("data", { ascending: true }),
  ]);

  if (gruposResult.error) {
    return NextResponse.json({ error: gruposResult.error.message }, { status: 500 });
  }

  if (jogosResult.error) {
    return NextResponse.json({ error: jogosResult.error.message }, { status: 500 });
  }

  const jogos = await enrichMissingPenaltyWinners((jogosResult.data ?? []) as JogoGrupo[]);

  return NextResponse.json({
    mataMata: buildKnockoutBracket((gruposResult.data ?? []) as GrupoRow[], jogos),
  });
}
