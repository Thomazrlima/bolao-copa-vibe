import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const BRACKET_VISIBILITY_KEY = "palpites_chaveamento_visible";
const DEFAULT_CONFIG = { chaveamento_visible: true };

type SupabaseMaybeError = {
  code?: string;
  message?: string;
};

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", BRACKET_VISIBILITY_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingConfigTable(error)) {
      return NextResponse.json(DEFAULT_CONFIG);
    }

    return NextResponse.json(
      { error: "Não foi possível carregar as configurações." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    chaveamento_visible: typeof data?.value === "boolean" ? data.value : true,
  });
}

function isMissingConfigTable(error: SupabaseMaybeError) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /app_config|schema cache|does not exist/i.test(error.message ?? "")
  );
}
