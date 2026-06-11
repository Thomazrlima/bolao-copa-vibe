import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ranking_usuarios")
    .select("id,nome_completo,pontos,chineladas")
    .order("pontos", { ascending: false })
    .order("chineladas", { ascending: false })
    .order("nome_completo", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ranking: data ?? [] });
}
