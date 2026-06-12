import { NextResponse } from "next/server";
import { z } from "zod";

import { getUsuarioMe, ServiceError, updateUsuarioMe } from "@/lib/server/bolao-service";
import { createClient } from "@/lib/supabase/server";

const updateUsuarioSchema = z
  .object({
    nome_completo: z.string().trim().min(1).max(160).optional(),
    telefone: z.string().trim().max(40).optional(),
    avatar_url: z.string().trim().max(255).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Informe ao menos um campo para atualizar.",
  });

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const usuario = await getUsuarioMe(supabase, auth.user.id);
    return NextResponse.json({ usuario });
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.message ?? "Não foi possível carregar seu perfil." },
      { status: serviceError?.status ?? 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const payload = updateUsuarioSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json(
      { error: "Payload inválido.", issues: payload.error.flatten() },
      { status: 400 },
    );
  }

  if (
    payload.data.avatar_url != null &&
    !new RegExp(
      `^${auth.user.id}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:jpg|png|webp)$`,
      "i",
    ).test(payload.data.avatar_url)
  ) {
    return NextResponse.json({ error: "Caminho de avatar inválido." }, { status: 400 });
  }

  try {
    const usuario = await updateUsuarioMe(supabase, auth.user.id, payload.data);
    return NextResponse.json({ usuario });
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.message ?? "Não foi possível atualizar seu perfil." },
      { status: serviceError?.status ?? 500 },
    );
  }
}
