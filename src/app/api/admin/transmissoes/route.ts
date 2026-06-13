import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageUsers } from "@/lib/admin-users";
import { createClient } from "@/lib/supabase/server";

const highlightSchema = z.object({
  highlights: z
    .array(
      z.object({
        slot: z.union([z.literal(1), z.literal(2)]),
        jogo_id: z.string().uuid(),
        url: z.string().trim().url().max(2048).refine(isHttpUrl),
      }),
    )
    .length(2)
    .refine((items) => new Set(items.map((item) => item.slot)).size === 2)
    .refine((items) => new Set(items.map((item) => item.jogo_id)).size === 2),
});

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!canManageUsers(auth.user.email)) {
    return NextResponse.json(
      { error: "Você não tem permissão para editar transmissões." },
      { status: 403 },
    );
  }

  const payload = highlightSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Selecione dois jogos diferentes e informe links http(s) válidos." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("salvar_transmissoes_admin", {
    p_highlights: payload.data.highlights,
  });

  if (error) {
    return NextResponse.json(
      { error: `Não foi possível salvar as transmissões: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ highlights: data ?? payload.data.highlights });
}

function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
