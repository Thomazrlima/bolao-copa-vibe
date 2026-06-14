import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  let recoverySession = false;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    recoverySession = !error && next === "/redefinir-senha";
  }

  const response = NextResponse.redirect(new URL(next, requestUrl.origin));

  if (recoverySession) {
    response.cookies.set("bolao-password-recovery", "1", {
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
