import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageUsers } from "@/lib/admin-users";
import { CAMPEAO_BOLAO_QUESTION_ID, ESPECIAIS, getEspecialQuestion } from "@/lib/especiais";
import { createAdminClient, hasAdminCredentials } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const TABLE = "palpites_especiais_respostas_corretas";

const answersSchema = z.object({
  respostas: z
    .array(
      z.object({
        pergunta_id: z.string().trim().min(1),
        resposta: z.string().trim().nullable(),
      }),
    )
    .refine((items) => new Set(items.map((item) => item.pergunta_id)).size === items.length, {
      message: "Perguntas duplicadas.",
    }),
});

type ParticipantRow = {
  id: string;
  nome_completo: string;
};

type RankingRecalculation = {
  jogos_recalculados: number;
  usuarios_atualizados: number;
};

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  const [answersResult, participantsResult] = await Promise.all([
    supabase.from(TABLE).select("pergunta_id,resposta,atualizado_em").order("pergunta_id"),
    supabase.from("ranking_usuarios").select("id,nome_completo").order("nome_completo"),
  ]);

  const firstError = answersResult.error ?? participantsResult.error;
  if (firstError) {
    return NextResponse.json(
      { error: `Não foi possível carregar os especiais: ${firstError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    respostas: answersResult.data ?? [],
    participantes: participantsResult.data ?? [],
  });
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { error: "ConfiguraÃ§Ã£o administrativa do Supabase ausente para salvar os especiais." },
      { status: 500 },
    );
  }

  const payload = answersSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Respostas inválidas." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: participants, error: participantsError } = await admin
    .from("ranking_usuarios")
    .select("id,nome_completo");

  if (participantsError) {
    return NextResponse.json(
      { error: `Não foi possível validar os participantes: ${participantsError.message}` },
      { status: 500 },
    );
  }

  const participantIds = new Set(((participants ?? []) as ParticipantRow[]).map((item) => item.id));
  const questionIds = new Set(ESPECIAIS.map((question) => question.id));
  const normalized = payload.data.respostas.map((item) => ({
    pergunta_id: item.pergunta_id,
    resposta: item.resposta?.trim() || null,
  }));

  for (const item of normalized) {
    const question = getEspecialQuestion(item.pergunta_id);

    if (!question || !questionIds.has(item.pergunta_id)) {
      return NextResponse.json(
        { error: "Uma das perguntas informadas não existe." },
        { status: 400 },
      );
    }

    if (!item.resposta) continue;

    const validAnswer =
      question.id === CAMPEAO_BOLAO_QUESTION_ID
        ? participantIds.has(item.resposta)
        : question.options.includes(item.resposta);

    if (!validAnswer) {
      return NextResponse.json(
        { error: `A resposta de "${question.question}" não pertence às opções da pergunta.` },
        { status: 400 },
      );
    }
  }

  const clearedIds = normalized.filter((item) => !item.resposta).map((item) => item.pergunta_id);
  if (clearedIds.length) {
    const { error } = await admin.from(TABLE).delete().in("pergunta_id", clearedIds);

    if (error) {
      return NextResponse.json(
        { error: `Não foi possível limpar respostas: ${error.message}` },
        { status: 500 },
      );
    }
  }

  const now = new Date().toISOString();
  const rows = normalized
    .filter((item): item is { pergunta_id: string; resposta: string } => Boolean(item.resposta))
    .map((item) => ({
      pergunta_id: item.pergunta_id,
      resposta: item.resposta,
      atualizado_em: now,
    }));

  if (rows.length) {
    const { error } = await admin.from(TABLE).upsert(rows, { onConflict: "pergunta_id" });

    if (error) {
      return NextResponse.json(
        { error: `Não foi possível salvar as respostas corretas: ${error.message}` },
        { status: 500 },
      );
    }
  }

  const ranking = await recalculateSpecialScores(admin);
  if ("error" in ranking) {
    return NextResponse.json(
      {
        error: `Respostas salvas, mas não foi possível atualizar o ranking: ${ranking.error}`,
      },
      { status: 500 },
    );
  }

  const { data, error } = await admin
    .from(TABLE)
    .select("pergunta_id,resposta,atualizado_em")
    .order("pergunta_id");

  if (error) {
    return NextResponse.json(
      { error: `Respostas salvas, mas não foi possível recarregar: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    respostas: data ?? [],
    ranking,
  });
}

async function recalculateSpecialScores(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<RankingRecalculation | { error: string }> {
  const totalsResult = await supabase.rpc("recalcular_totais_usuarios");

  if (!totalsResult.error) {
    return {
      jogos_recalculados: 0,
      usuarios_atualizados: Number(totalsResult.data ?? 0),
    };
  }

  const fullResult = await supabase.rpc("recalcular_ranking_completo");

  if (fullResult.error) {
    return { error: `${totalsResult.error.message}; ${fullResult.error.message}` };
  }

  const row = Array.isArray(fullResult.data) ? fullResult.data[0] : fullResult.data;

  return {
    jogos_recalculados: Number(row?.jogos_recalculados ?? 0),
    usuarios_atualizados: Number(row?.usuarios_atualizados ?? 0),
  };
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!canManageUsers(data.user.email)) {
    return NextResponse.json(
      { error: "Você não tem permissão para editar os especiais." },
      { status: 403 },
    );
  }

  return data.user;
}
