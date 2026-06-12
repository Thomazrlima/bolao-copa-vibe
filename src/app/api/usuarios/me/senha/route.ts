import { NextResponse } from "next/server";
import { z } from "zod";

import { ServiceError, updateAuthenticatedUserPassword } from "@/lib/server/bolao-service";
import { createClient } from "@/lib/supabase/server";

const updatePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const payload = updatePasswordSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json(
      { error: "Payload inválido.", issues: payload.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await updateAuthenticatedUserPassword(
      supabase,
      auth.user.email,
      payload.data.current_password,
      payload.data.new_password,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const serviceError = error instanceof ServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.message ?? "Não foi possível alterar a senha." },
      { status: serviceError?.status ?? 500 },
    );
  }
}
