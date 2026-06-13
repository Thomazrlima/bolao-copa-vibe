import { NextResponse } from "next/server";

import { canManageUsers } from "@/lib/admin-users";
import { createClient } from "@/lib/supabase/server";

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
