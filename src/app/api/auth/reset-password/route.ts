import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

const RECOVERY_COOKIE = "bolao-password-recovery";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({
    ready: Boolean(user && request.cookies.get(RECOVERY_COOKIE)?.value === "1"),
  });
}

export async function POST(request: NextRequest) {
  if (request.cookies.get(RECOVERY_COOKIE)?.value !== "1") {
    return NextResponse.json({ error: "Link de recuperação inválido ou expirado." }, { status: 401 });
  }

  const payload = resetPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "A nova senha deve ter pelo menos 8 caracteres." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Link de recuperação inválido ou expirado." }, { status: 401 });
  }

  const { error } = await supabase.auth.updateUser({ password: payload.data.password });
  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Não foi possível redefinir a senha." },
      { status: 400 },
    );
  }

  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(RECOVERY_COOKIE);
  return response;
}
