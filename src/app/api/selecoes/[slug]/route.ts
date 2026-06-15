import { NextResponse } from "next/server";

import { getPerfilSelecao, ServiceError } from "@/lib/server/bolao-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  try {
    const selecao = await getPerfilSelecao(supabase, slug);
    return NextResponse.json({ selecao });
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.message ?? "Não foi possível carregar o perfil da seleção." },
      { status: serviceError?.status ?? 500 },
    );
  }
}
