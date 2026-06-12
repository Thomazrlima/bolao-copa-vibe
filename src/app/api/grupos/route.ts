import { NextResponse } from "next/server";

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
      .select("id,fase_id,time1,time2,data,gols1,gols2,encerrado")
      .eq("fase_id", 1)
      .order("data", { ascending: true }),
  ]);

  if (gruposResult.error) {
    return NextResponse.json({ error: gruposResult.error.message }, { status: 500 });
  }

  if (jogosResult.error) {
    return NextResponse.json({ error: jogosResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    grupos: gruposResult.data ?? [],
    jogos: jogosResult.data ?? [],
  });
}
