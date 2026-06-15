import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

const RECOVERY_COOKIE = "bolao-password-recovery";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  let verifiedRecovery = false;

  if (tokenHash && type === "recovery" && next === "/redefinir-senha") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    verifiedRecovery = !error;
  }

  const response = NextResponse.redirect(
    new URL(verifiedRecovery ? next : "/login", requestUrl.origin),
  );

  if (verifiedRecovery) {
    response.cookies.set(RECOVERY_COOKIE, "1", {
      httpOnly: true,
      maxAge: 60 * 60,
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      path: "/",
    });
  }

  return response;
}

function safeNextPath(next: string | null) {
  if (!next?.startsWith("/") || next.startsWith("//")) return "/ranking";
  return next;
}
