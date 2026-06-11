import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const updateUsuarioSchema = z
  .object({
    nome_completo: z.string().trim().min(1).max(160).optional(),
    telefone: z.string().trim().min(1).max(40).optional(),
  })
  .refine((data) => data.nome_completo !== undefined || data.telefone !== undefined, {
    message: "Informe nome_completo ou telefone para atualizar.",
  });

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("id,email,nome_completo,telefone,pontos,chineladas,created_at,updated_at")
    .eq("id", auth.user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ usuario: data });
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

  const { data, error } = await supabase
    .from("usuarios")
    .update(payload.data)
    .eq("id", auth.user.id)
    .select("id,email,nome_completo,telefone,pontos,chineladas,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ usuario: data });
}
