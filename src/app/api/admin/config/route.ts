import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageUsers } from "@/lib/admin-users";
import { createClient } from "@/lib/supabase/server";

const BRACKET_VISIBILITY_KEY = "palpites_chaveamento_visible";
const DEFAULT_CONFIG = { chaveamento_visible: true };

type SupabaseMaybeError = {
  code?: string;
  message?: string;
};

const configSchema = z.object({
  chaveamento_visible: z.boolean(),
});

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const config = await loadConfig();
  if (config instanceof NextResponse) return config;

  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const payload = configSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Configuração inválida." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("app_config").upsert({
    key: BRACKET_VISIBILITY_KEY,
    value: payload.data.chaveamento_visible,
  });

  if (error) {
    if (isMissingConfigTable(error)) {
      return NextResponse.json(
        {
          error: "A tabela app_config ainda não existe. Rode as migrations para salvar esta opção.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: `Não foi possível salvar as configurações: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(payload.data);
}

async function loadConfig() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", BRACKET_VISIBILITY_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingConfigTable(error)) {
      return DEFAULT_CONFIG;
    }

    return NextResponse.json(
      { error: `Não foi possível carregar as configurações: ${error.message}` },
      { status: 500 },
    );
  }

  return {
    chaveamento_visible: typeof data?.value === "boolean" ? data.value : true,
  };
}

function isMissingConfigTable(error: SupabaseMaybeError) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /app_config|schema cache|does not exist/i.test(error.message ?? "")
  );
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!canManageUsers(data.user.email)) {
    return NextResponse.json(
      { error: "Você não tem permissão para acessar a administração." },
      { status: 403 },
    );
  }

  return data.user;
}
