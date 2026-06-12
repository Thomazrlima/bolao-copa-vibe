import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { canManageUsers } from "@/lib/admin-users";
import { createAdminClient, hasAdminCredentials } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const createUsuarioSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  nome_completo: z.string().trim().min(1).max(160),
  telefone: z
    .string()
    .trim()
    .max(40)
    .transform(normalizeBrazilianPhone)
    .refine((telefone) => /^\+55\d{10,11}$/.test(telefone)),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!canManageUsers(auth.user.email)) {
    return NextResponse.json(
      { error: "Você não tem permissão para adicionar usuários." },
      { status: 403 },
    );
  }

  const payload = createUsuarioSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json(
      {
        error: "Preencha um e-mail válido, o nome completo e um telefone brasileiro com DDD.",
      },
      { status: 400 },
    );
  }

  try {
    const temporaryPassword = payload.data.email.split("@", 1)[0];
    const metadata = {
      nome_completo: payload.data.nome_completo,
      telefone: payload.data.telefone,
    };

    if (!hasAdminCredentials()) {
      const signupClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );
      const { data, error } = await signupClient.auth.signUp({
        email: payload.data.email,
        password: temporaryPassword,
        options: { data: metadata },
      });
      const duplicate = data.user?.identities?.length === 0;

      if (error || !data.user || duplicate) {
        const emailRateLimited = error?.message.toLowerCase().includes("email rate limit");

        return NextResponse.json(
          {
            error: duplicate
              ? "Já existe um usuário com este e-mail."
              : emailRateLimited
                ? "O limite de e-mails do Supabase foi atingido. Desative Confirm email em Authentication > Providers > Email para cadastrar sem enviar confirmação."
                : (error?.message ?? "Não foi possível criar o usuário."),
          },
          { status: duplicate ? 409 : emailRateLimited ? 429 : 500 },
        );
      }

      return NextResponse.json(
        {
          usuario: buildUsuarioResponse(data.user.id, payload.data),
          temporary_password: temporaryPassword,
          email_confirmation_required: !data.session,
        },
        { status: 201 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: payload.data.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error || !data.user) {
      const duplicate = error?.message.toLowerCase().includes("already");
      return NextResponse.json(
        {
          error: duplicate
            ? "Já existe um usuário com este e-mail."
            : "Não foi possível criar o usuário.",
        },
        { status: duplicate ? 409 : 500 },
      );
    }

    const { error: profileError, count: updatedProfiles } = await admin
      .from("usuarios")
      .update(
        {
          email: payload.data.email,
          nome_completo: payload.data.nome_completo,
          telefone: payload.data.telefone,
          pontos: 0,
          chineladas: 0,
        },
        { count: "exact" },
      )
      .eq("id", data.user.id);

    if (profileError || updatedProfiles !== 1) {
      await admin.auth.admin.deleteUser(data.user.id);
      console.error("Falha ao criar o perfil do novo usuário:", profileError);
      return NextResponse.json(
        { error: "Não foi possível criar o perfil do usuário." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        usuario: buildUsuarioResponse(data.user.id, payload.data),
        temporary_password: temporaryPassword,
        email_confirmation_required: false,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Falha ao adicionar usuário:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Não foi possível criar o usuário.",
      },
      { status: 500 },
    );
  }
}

function buildUsuarioResponse(id: string, payload: z.infer<typeof createUsuarioSchema>) {
  return {
    id,
    email: payload.email,
    nome_completo: payload.nome_completo,
    telefone: payload.telefone,
    pontos: 0,
    chineladas: 0,
  };
}

function normalizeBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const nationalNumber =
    digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
      ? digits.slice(2)
      : digits;

  return `+55${nationalNumber}`;
}
