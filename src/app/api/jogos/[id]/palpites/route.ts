import { NextResponse } from "next/server";
import { z } from "zod";

import { getPalpitesDoJogo, ServiceError } from "@/lib/server/bolao-service";
import { upsertPalpite } from "@/lib/server/palpites-service";
import { createClient } from "@/lib/supabase/server";

const palpiteSchema = z.object({
  gols1: z.number().int().min(0).max(20),
  gols2: z.number().int().min(0).max(20),
});

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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const payload = palpiteSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json({ error: "Informe placares válidos entre 0 e 20." }, { status: 400 });
  }

  try {
    const palpite = await upsertPalpite(
      supabase,
      auth.user.id,
      id,
      payload.data.gols1,
      payload.data.gols2,
    );
    return NextResponse.json({ palpite });
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.message ?? "Não foi possível salvar o palpite." },
      { status: serviceError?.status ?? 500 },
    );
  }
}
