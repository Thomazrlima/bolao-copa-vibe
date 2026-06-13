import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageUsers } from "@/lib/admin-users";
import { createClient } from "@/lib/supabase/server";

const updateBugReportSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["novo", "resolvido"]),
});

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!canManageUsers(auth.user.email)) {
    return NextResponse.json(
      { error: "Você não tem permissão para acessar a administração." },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("bug_reports")
    .select(
      "id,user_id,nome,email,pagina,descricao,passos,esperado,atual,navegador,status,criado_em",
    )
    .order("criado_em", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: `Não foi possível carregar os bug reports: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ reports: data ?? [] });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!canManageUsers(auth.user.email)) {
    return NextResponse.json(
      { error: "Você não tem permissão para atualizar chamados." },
      { status: 403 },
    );
  }

  const payload = updateBugReportSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Chamado ou status inválido." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bug_reports")
    .update({ status: payload.data.status })
    .eq("id", payload.data.id)
    .select(
      "id,user_id,nome,email,pagina,descricao,passos,esperado,atual,navegador,status,criado_em",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Não foi possível atualizar o chamado: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ report: data });
}
