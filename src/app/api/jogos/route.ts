import { NextResponse } from "next/server";

import { enrichMissingPenaltyWinners } from "@/lib/server/knockout-penalty-enrichment";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jogos")
    .select(
      "id,sportsdb_event_id,worldcup2026_game_id,fase_id,codigo_mata_mata,time1,time2,data,gols1,gols2,penaltis1,penaltis2,vencedor,encerrado,rodada,placar_status,sportsdb_status,sincronizado_em",
    )
    .order("data", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const jogos = await enrichMissingPenaltyWinners(data ?? []);

  return NextResponse.json({ jogos });
}
