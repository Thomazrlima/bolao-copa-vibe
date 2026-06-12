import { NextResponse } from "next/server";

import { ServiceError } from "@/lib/server/bolao-service";
import { getPalpitesDashboard } from "@/lib/server/palpites-service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    return NextResponse.json(await getPalpitesDashboard(supabase, auth.user.id));
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.message ?? "Não foi possível carregar seus palpites." },
      { status: serviceError?.status ?? 500 },
    );
  }
}
