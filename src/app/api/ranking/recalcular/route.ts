import { NextResponse } from "next/server";

import { recalcularRankingCompleto, ServiceError } from "@/lib/server/bolao-service";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();

  try {
    const resultado = await recalcularRankingCompleto(supabase);
    return NextResponse.json({ resultado });
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.message ?? "Não foi possível recalcular o ranking." },
      { status: serviceError?.status ?? 500 },
    );
  }
}
