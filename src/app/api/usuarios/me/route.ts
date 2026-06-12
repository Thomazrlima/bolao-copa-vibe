import { NextResponse } from "next/server";
import { z } from "zod";

import { getUsuarioMe, ServiceError, updateUsuarioMe } from "@/lib/server/bolao-service";
import { createClient } from "@/lib/supabase/server";

const updateUsuarioSchema = z
  .object({
    nome_completo: z.string().trim().min(1).max(160).optional(),
    telefone: z.string().trim().max(40).optional(),
    avatar_url: z.string().trim().max(5_000_000).nullable().optional(),
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
