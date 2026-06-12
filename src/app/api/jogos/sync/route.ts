import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { lookupSportsDbScore } from "@/lib/thesportsdb";

type JogoSync = {
  sportsdb_event_id: string | null;
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
    .select("sportsdb_event_id,data,encerrado")
    .not("sportsdb_event_id", "is", null)
    .lte("data", nowIso)
    .eq("encerrado", false)
    .order("data", { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const synced = [];
  const recalculated = [];

  for (const jogo of (jogos ?? []) as JogoSync[]) {
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
      recalculated.push(score.eventId);
    }
  }

  return NextResponse.json({ synced, recalculated });
}
