import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageUsers } from "@/lib/admin-users";
import { createAdminClient, hasAdminCredentials } from "@/lib/supabase/admin";
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

  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { error: "A credencial administrativa do Supabase não está configurada." },
      { status: 503 },
    );
  }

  const payload = highlightSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Selecione dois jogos diferentes e informe links http(s) válidos." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const gameIds = payload.data.highlights.map((highlight) => highlight.jogo_id);
  const { data: games, error: gamesError } = await admin
    .from("jogos")
    .select("id")
    .in("id", gameIds);

  if (gamesError || games?.length !== 2) {
    return NextResponse.json(
      { error: gamesError?.message ?? "Um dos jogos selecionados não existe." },
      { status: 400 },
    );
  }

  for (const highlight of payload.data.highlights) {
    const { error } = await admin
      .from("jogos")
      .update({ transmissao_url: highlight.url })
      .eq("id", highlight.jogo_id);

    if (error) {
      return NextResponse.json(
        { error: `Não foi possível salvar o link do jogo: ${error.message}` },
        { status: 500 },
      );
    }
  }

  const { error: highlightError } = await admin.from("transmissao_destaques").upsert(
    payload.data.highlights.map((highlight) => ({
      slot: highlight.slot,
      jogo_id: highlight.jogo_id,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "slot" },
  );

  if (highlightError) {
    return NextResponse.json(
      { error: `Não foi possível salvar os jogos em destaque: ${highlightError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ highlights: payload.data.highlights });
}

function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
