import { NextResponse } from "next/server";
import { z } from "zod";

import { getPalpiteChaveamento, salvarPalpiteChaveamento } from "@/lib/server/chaveamento-service";
import { ServiceError } from "@/lib/server/bolao-service";
import { createClient } from "@/lib/supabase/server";

const confrontoSchema = z.object({
  fase_id: z.number().int().min(2),
  slot: z.number().int().min(0),
  time1: z.string().min(1),
  time2: z.string().min(1),
  vencedor: z.string().min(1),
});

const chaveamentoSchema = z.object({
  confrontos: z.array(confrontoSchema).min(1),
});

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "NÃ£o autenticado." }, { status: 401 });
  }

  try {
    const chaveamento = await getPalpiteChaveamento(supabase, auth.user.id);
    return NextResponse.json({ chaveamento });
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.message ?? "NÃ£o foi possÃ­vel carregar o chaveamento." },
      { status: serviceError?.status ?? 500 },
    );
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "NÃ£o autenticado." }, { status: 401 });
  }

  const payload = chaveamentoSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json(
      { error: "Envie pelo menos um confronto vÃ¡lido do chaveamento." },
      { status: 400 },
    );
  }

  try {
    const chaveamento = await salvarPalpiteChaveamento(
      supabase,
      auth.user.id,
      payload.data.confrontos,
    );
    return NextResponse.json({ chaveamento });
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.message ?? "NÃ£o foi possÃ­vel salvar o chaveamento." },
      { status: serviceError?.status ?? 500 },
    );
  }
}
