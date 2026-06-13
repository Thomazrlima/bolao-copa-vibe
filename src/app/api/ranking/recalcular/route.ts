import { NextResponse } from "next/server";

import { canManageUsers } from "@/lib/admin-users";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!canManageUsers(auth.user.email)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("recalcular_ranking_completo_admin");

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Não foi possível recalcular o ranking." },
      { status: 500 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    resultado: {
      jogos_recalculados: Number(row?.jogos_recalculados ?? 0),
      usuarios_atualizados: Number(row?.usuarios_atualizados ?? 0),
    },
  });
}
