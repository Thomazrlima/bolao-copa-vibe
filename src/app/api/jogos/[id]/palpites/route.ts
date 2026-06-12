import { NextResponse } from "next/server";

import { getPalpitesDoJogo, ServiceError } from "@/lib/server/bolao-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const payload = await getPalpitesDoJogo(supabase, id);
    return NextResponse.json(payload);
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.message ?? "Não foi possível carregar os palpites do jogo." },
      { status: serviceError?.status ?? 500 },
    );
  }
}
