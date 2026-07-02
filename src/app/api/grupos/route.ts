import { NextResponse } from "next/server";

import { enrichMissingPenaltyWinners } from "@/lib/server/knockout-penalty-enrichment";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const [gruposResult, jogosResult] = await Promise.all([
    supabase
      .from("grupos")
      .select("grupo,time,pontuacao,saldo_gols,gols_pro,gols_contra,updated_at")
      .order("grupo", { ascending: true })
      .order("pontuacao", { ascending: false })
      .order("saldo_gols", { ascending: false })
      .order("gols_pro", { ascending: false }),
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

  const jogos = await enrichMissingPenaltyWinners(jogosResult.data ?? []);

  return NextResponse.json({
    grupos: gruposResult.data ?? [],
    jogos,
  });
}
