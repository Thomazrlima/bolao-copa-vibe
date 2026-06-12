import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jogos")
    .select(
      "id,sportsdb_event_id,fase_id,time1,time2,data,gols1,gols2,encerrado,rodada,sportsdb_status,sincronizado_em",
    )
    .order("data", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jogos: data ?? [] });
}
