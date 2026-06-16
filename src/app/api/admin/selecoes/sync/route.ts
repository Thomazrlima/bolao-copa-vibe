import { NextResponse } from "next/server";

import { canManageUsers } from "@/lib/admin-users";
import { hasApiFootballCredentials } from "@/lib/apifootball";
import { synchronizeSelectionPlayers } from "@/lib/server/selection-player-sync";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const authResult = await requireAdmin(supabase);
  if (authResult instanceof NextResponse) return authResult;

  if (!hasApiFootballCredentials()) {
    return NextResponse.json({ error: "API_FOOTBALL_KEY não está configurada." }, { status: 503 });
  }

  const startedAt = Date.now();
  const executionResult = await supabase
    .from("sync_jogos_execucoes")
    .insert({ iniciado_em: new Date(startedAt).toISOString() })
    .select("id")
    .maybeSingle();
  const executionId = executionResult.data?.id ?? null;

  try {
    const result = await synchronizeSelectionPlayers(supabase);
    const diagnosticos = result.erros.map((erro) => ({
      jogo_id: "",
      evento_id: erro.codigo,
      jogo: erro.nome,
      tipo: "jogadores",
      consultado_em: result.finished_at,
      interpretado: null,
      resposta: null,
      erro: erro.erro,
    }));

    if (executionId) {
      await supabase
        .from("sync_jogos_execucoes")
        .update({
          finalizado_em: result.finished_at,
          sucesso: result.ok,
          erro: result.ok
            ? null
            : `${result.selecoes_com_erro} seleção(ões) com erro no sync de jogadores.`,
          duracao_ms: result.duration_ms,
          resumo: {
            modo: result.modo,
            selecoes_processadas: result.selecoes_processadas,
            selecoes_com_erro: result.selecoes_com_erro,
            jogadores_salvos: result.jogadores_salvos,
            chamadas_api_football: result.chamadas_api_football,
          },
          diagnosticos,
        })
        .eq("id", executionId);
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível sincronizar jogadores das seleções.";

    if (executionId) {
      await supabase
        .from("sync_jogos_execucoes")
        .update({
          finalizado_em: new Date().toISOString(),
          sucesso: false,
          erro: message,
          duracao_ms: Date.now() - startedAt,
          resumo: {
            modo: "pendentes",
            selecoes_processadas: 0,
            jogadores_salvos: 0,
          },
          diagnosticos: [],
        })
        .eq("id", executionId);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!canManageUsers(data.user.email)) {
    return NextResponse.json(
      { error: "Você não tem permissão para sincronizar jogadores." },
      { status: 403 },
    );
  }

  return data.user;
}
