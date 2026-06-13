import { NextResponse } from "next/server";

import { createAdminClient, hasAdminCredentials } from "@/lib/supabase/admin";
import { lookupSportsDbScore } from "@/lib/thesportsdb";

type JogoSync = {
  id: string;
  sportsdb_event_id: string | null;
  data: string;
  encerrado: boolean;
};

type SyncSummary = {
  jogos_elegiveis: number;
  jogos_sincronizados: number;
  jogos_encerrados: number;
  provedores: {
    thesportsdb: number;
  };
};

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET não está configurado." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { error: "A credencial administrativa do Supabase não está configurada." },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  const supabase = createAdminClient();
  const lockResult = await supabase.rpc("tentar_iniciar_sync_jogos", {
    p_lock_segundos: 90,
  });

  if (lockResult.error) {
    return NextResponse.json(
      { error: `Não foi possível adquirir o lock: ${lockResult.error.message}` },
      { status: 500 },
    );
  }

  if (!lockResult.data) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "sync_em_andamento" },
      { status: 202 },
    );
  }

  let summary: SyncSummary = {
    jogos_elegiveis: 0,
    jogos_sincronizados: 0,
    jogos_encerrados: 0,
    provedores: { thesportsdb: 0 },
  };
  let syncError: string | null = null;

  try {
    summary = await synchronizeGames(supabase);
  } catch (error) {
    syncError = error instanceof Error ? error.message : "Erro desconhecido ao sincronizar jogos.";
  }

  const durationMs = Date.now() - startedAt;
  const finalizeResult = await supabase.rpc("finalizar_sync_jogos", {
    p_sucesso: syncError == null,
    p_erro: syncError,
    p_jogos_elegiveis: summary.jogos_elegiveis,
    p_jogos_sincronizados: summary.jogos_sincronizados,
    p_duracao_ms: durationMs,
  });

  if (finalizeResult.error) {
    return NextResponse.json(
      { error: `Não foi possível finalizar o sync: ${finalizeResult.error.message}` },
      { status: 500 },
    );
  }

  if (syncError) {
    return NextResponse.json(
      {
        ok: false,
        error: syncError,
        duracao_ms: durationMs,
        ...summary,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    iniciado_em: new Date(startedAt).toISOString(),
    finalizado_em: new Date().toISOString(),
    duracao_ms: durationMs,
    ...summary,
  });
}

async function synchronizeGames(supabase: ReturnType<typeof createAdminClient>) {
  const nowIso = nowAsStoredBrasiliaIso();
  const { data: jogos, error } = await supabase
    .from("jogos")
    .select("id,sportsdb_event_id,data,encerrado")
    .lte("data", nowIso)
    .eq("encerrado", false)
    .not("sportsdb_event_id", "is", null)
    .order("data", { ascending: true })
    .limit(10);

  if (error) throw new Error(error.message);

  const syncableJogos = (jogos ?? []) as JogoSync[];
  const summary: SyncSummary = {
    jogos_elegiveis: syncableJogos.length,
    jogos_sincronizados: 0,
    jogos_encerrados: 0,
    provedores: { thesportsdb: 0 },
  };

  for (const jogo of syncableJogos) {
    if (!jogo.sportsdb_event_id) continue;

    const score = await lookupSportsDbScore(jogo.sportsdb_event_id);
    if (!score) continue;

    const { error: updateError } = await supabase.rpc("atualizar_placar_jogo_sportsdb", {
      p_sportsdb_event_id: score.eventId,
      p_gols1: score.gols1,
      p_gols2: score.gols2,
      p_encerrado: score.encerrado,
      p_status: score.status,
    });

    if (updateError) throw new Error(updateError.message);

    summary.jogos_sincronizados += 1;
    summary.provedores.thesportsdb += 1;
    if (score.encerrado) summary.jogos_encerrados += 1;
  }

  return summary;
}

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
