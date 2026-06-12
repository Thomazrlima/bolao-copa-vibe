import { NextResponse } from "next/server";
import { z } from "zod";

import { CAMPEAO_BOLAO_QUESTION_ID, especiaisAreOpen, getEspecialQuestion } from "@/lib/especiais";
import { createClient } from "@/lib/supabase/server";

const answerSchema = z.object({
  pergunta_id: z.string().trim().min(1),
  resposta: z.string().trim().min(1),
});

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("palpites_especiais")
    .select("pergunta_id,resposta,atualizado_em")
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ respostas: data ?? [] });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!especiaisAreOpen()) {
    return NextResponse.json(
      { error: "O prazo para responder aos palpites especiais encerrou." },
      { status: 409 },
    );
  }

  const payload = answerSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json({ error: "Resposta inválida." }, { status: 400 });
  }

  const question = getEspecialQuestion(payload.data.pergunta_id);
  if (!question) {
    return NextResponse.json(
      { error: "Essa opção não pertence à pergunta informada." },
      { status: 400 },
    );
  }

  if (question.id === CAMPEAO_BOLAO_QUESTION_ID) {
    const { data: participant, error: participantError } = await supabase
      .from("ranking_usuarios")
      .select("id")
      .eq("id", payload.data.resposta)
      .maybeSingle();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "Essa opção não pertence à pergunta informada." },
        { status: 400 },
      );
    }
  } else if (!question.options.includes(payload.data.resposta)) {
    return NextResponse.json(
      { error: "Essa opção não pertence à pergunta informada." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("palpites_especiais")
    .upsert(
      {
        user_id: auth.user.id,
        pergunta_id: question.id,
        resposta: payload.data.resposta,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "user_id,pergunta_id" },
    )
    .select("pergunta_id,resposta,atualizado_em")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ resposta: data });
}
