import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageUsers } from "@/lib/admin-users";
import { createAdminClient, hasAdminCredentials } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const scoreCorrectionSchema = z.object({
  jogo_id: z.string().uuid(),
  gols1: z.number().int().min(0).max(99),
  gols2: z.number().int().min(0).max(99),
});

type GameRow = {
  id: string;
  fase_id: number;
  time1: string;
  time2: string;
  data: string;
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
  transmissao_url: string | null;
};

type RecalculateGameRow = {
  palpites_calculados: number;
  usuarios_atualizados: number;
};

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!canManageUsers(auth.user.email)) {
    return NextResponse.json(
      { error: "Você não tem permissão para corrigir placares." },
      { status: 403 },
    );
  }

  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { error: "Configuração administrativa do Supabase ausente para corrigir placares." },
      { status: 500 },
    );
  }

  const payload = scoreCorrectionSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Selecione um jogo encerrado e informe placares válidos." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { jogo_id: jogoId, gols1, gols2 } = payload.data;

  const { data: game, error: gameError } = await admin
    .from("jogos")
    .select("id,fase_id,time1,time2,data,gols1,gols2,encerrado,transmissao_url")
    .eq("id", jogoId)
    .single();

  if (gameError || !game) {
    return NextResponse.json(
      { error: `Não foi possível carregar o jogo: ${gameError?.message ?? "não encontrado"}` },
      { status: gameError?.code === "PGRST116" ? 404 : 500 },
    );
  }

  const currentGame = game as GameRow;
  if (!currentGame.encerrado) {
    return NextResponse.json(
      { error: "A correção manual só está disponível para jogos encerrados." },
      { status: 400 },
    );
  }

  const { data: updatedGame, error: updateGameError } = await admin
    .from("jogos")
    .update({ gols1, gols2, placar_status: "finished" })
    .eq("id", jogoId)
    .eq("encerrado", true)
    .select("id,fase_id,time1,time2,data,gols1,gols2,encerrado,transmissao_url")
    .single();

  if (updateGameError || !updatedGame) {
    return NextResponse.json(
      { error: `Não foi possível salvar o placar corrigido: ${updateGameError?.message}` },
      { status: 500 },
    );
  }

  const rankingResult = await admin.rpc("recalcular_pontuacao_jogo", { p_jogo_id: jogoId });
  if (rankingResult.error) {
    return NextResponse.json(
      {
        error: `Placar salvo, mas não foi possível recalcular pontos e chineladas: ${rankingResult.error.message}`,
      },
      { status: 500 },
    );
  }

  const groupsResult = await admin.rpc("recalcular_grupos");
  if (groupsResult.error) {
    return NextResponse.json(
      {
        error: `Placar, pontos e chineladas salvos, mas não foi possível recalcular grupos: ${groupsResult.error.message}`,
      },
      { status: 500 },
    );
  }

  const rankingRow = Array.isArray(rankingResult.data)
    ? (rankingResult.data[0] as RecalculateGameRow | undefined)
    : (rankingResult.data as RecalculateGameRow | null);

  return NextResponse.json({
    jogo: updatedGame,
    ranking: {
      palpites_calculados: Number(rankingRow?.palpites_calculados ?? 0),
      usuarios_atualizados: Number(rankingRow?.usuarios_atualizados ?? 0),
    },
  });
}
