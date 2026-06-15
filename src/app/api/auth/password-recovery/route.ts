import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const recoverySchema = z.object({
  email: z.string().trim().email(),
});

const GENERIC_RESPONSE =
  "Se este e-mail estiver cadastrado, enviaremos instruções para redefinir sua senha.";

export async function POST(request: NextRequest) {
  const payload = recoverySchema.safeParse(await request.json().catch(() => null));

  if (payload.success) {
    const supabase = await createClient();
    const redirectTo = new URL("/auth/callback?next=/redefinir-senha", publicAppUrl(request));

    const { error } = await supabase.auth.resetPasswordForEmail(payload.data.email, {
      redirectTo: redirectTo.toString(),
    });

    if (error) {
      console.error("Supabase password recovery request failed", {
        code: error.code,
        message: error.message,
        status: error.status,
      });
    }
  }

  return NextResponse.json({ message: GENERIC_RESPONSE });
}

function publicAppUrl(request: NextRequest) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    process.env.VERCEL_URL;

  if (configuredUrl) {
    return normalizeUrl(configuredUrl);
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";

  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

function normalizeUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
