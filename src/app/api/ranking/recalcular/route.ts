import { NextResponse } from "next/server";

import { canManageUsers } from "@/lib/admin-users";
import { recalcularRankingCompleto, ServiceError } from "@/lib/server/bolao-service";
import { createAdminClient, hasAdminCredentials } from "@/lib/supabase/admin";
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

  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { error: "A credencial administrativa do Supabase não está configurada." },
      { status: 503 },
    );
  }

  try {
    const resultado = await recalcularRankingCompleto(createAdminClient());
    return NextResponse.json({ resultado });
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.message ?? "Não foi possível recalcular o ranking." },
      { status: serviceError?.status ?? 500 },
    );
  }
}
