import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient, hasAdminCredentials } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bugReportSchema = z.object({
  pagina: z.string().trim().max(220).optional().default(""),
  descricao: z.string().trim().min(1).max(2000),
  passos: z.string().trim().max(2000).optional().default(""),
  esperado: z.string().trim().max(1200).optional().default(""),
  atual: z.string().trim().max(1200).optional().default(""),
  navegador: z.string().trim().max(500).optional().default(""),
});

export async function POST(request: Request) {
  const payload = bugReportSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json(
      { error: "Preencha a descrição do bug antes de enviar." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.json(
      { error: "Você precisa estar logado para enviar um bug report." },
      { status: 401 },
    );
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nome_completo,email")
    .eq("id", auth.user.id)
    .maybeSingle();

  const email = auth.user.email ?? usuario?.email;
  const nome = usuario?.nome_completo ?? auth.user.email;

  if (!email) {
    return NextResponse.json(
      { error: "Não foi possível identificar seu e-mail de usuário." },
      { status: 400 },
    );
  }

  const db = hasAdminCredentials() ? createAdminClient() : supabase;
  const { error } = await db.from("bug_reports").insert({
    user_id: auth.user.id,
    nome: nome || null,
    email,
    pagina: payload.data.pagina || null,
    descricao: payload.data.descricao,
    passos: payload.data.passos || null,
    esperado: payload.data.esperado || null,
    atual: payload.data.atual || null,
    navegador: payload.data.navegador || null,
  });

  if (error) {
    return NextResponse.json(
      { error: `Não foi possível salvar o bug report agora: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
