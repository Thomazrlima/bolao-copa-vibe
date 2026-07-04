import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageUsers } from "@/lib/admin-users";
import { createClient } from "@/lib/supabase/server";

const recalculateKnockoutSchema = z.object({
  fase_id: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(7)]),
});

type RecalculateKnockoutRow = {
  palpites_calculados: number;
  usuarios_atualizados: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!canManageUsers(auth.user.email)) {
    return NextResponse.json(
      { error: "Você não tem permissão para recalcular a pontuação do mata-mata." },
      { status: 403 },
    );
  }

  const payload = recalculateKnockoutSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Selecione uma fase válida do mata-mata." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("recalcular_pontuacao_chaveamento_admin", {
    p_fase_id: payload.data.fase_id,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Não foi possível recalcular a pontuação do mata-mata." },
      { status: 500 },
    );
  }

  const row = Array.isArray(data)
    ? (data[0] as RecalculateKnockoutRow | undefined)
    : (data as RecalculateKnockoutRow | null);

  return NextResponse.json({
    resultado: {
      palpites_calculados: Number(row?.palpites_calculados ?? 0),
      usuarios_atualizados: Number(row?.usuarios_atualizados ?? 0),
    },
  });
}
