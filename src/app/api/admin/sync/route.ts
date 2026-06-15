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

  const { data, error } = await supabase.rpc("admin_sync_execucoes_bolao");

  if (error) {
    return NextResponse.json(
      { error: `Não foi possível carregar o histórico do sync: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    executions: data ?? [],
  });
}
