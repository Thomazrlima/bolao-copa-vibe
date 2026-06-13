"use client";

import { useEffect, useMemo, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { BrazilThemedName } from "@/components/common/BrazilThemedName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Usuario = {
  id: string;
  email: string;
  nome_completo: string;
  telefone: string;
};

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadUsuario() {
    const response = await fetch("/api/usuarios/me", { cache: "no-store" });

    if (response.status === 401) {
      setUsuario(null);
      return null;
    }

    const body = await response.json();
    const loadedUsuario = body.usuario ?? null;
    setUsuario(loadedUsuario);
    return loadedUsuario as Usuario | null;
  }

  useEffect(() => {
    let active = true;

    async function loadSession() {
      setLoading(true);
      await loadUsuario();
      if (active) setLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUsuario();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    const loadedUsuario = await loadUsuario();
    setPassword("");
    setSubmitting(false);

    if (loadedUsuario?.id) {
      router.replace(`/perfil/${encodeURIComponent(loadedUsuario.id)}`);
      router.refresh();
    }
  }

  async function handleLogout() {
    setSubmitting(true);
    setMessage(null);
    await supabase.auth.signOut();
    setUsuario(null);
    setSubmitting(false);
  }

  return (
    <>
      <div className="mx-auto max-w-md">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Login</h2>
          {usuario ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Você está logado como{" "}
              <BrazilThemedName className="font-semibold text-foreground">
                {usuario.nome_completo}
              </BrazilThemedName>
              .
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Para fazer seus palpites, você precisa entrar na sua conta.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          {loading ? (
            <SpinningBallLoader label="Carregando sessão" size="md" className="min-h-[180px]" />
          ) : usuario ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Usuário logado
                </p>
                <p className="mt-2 font-display text-xl font-black">
                  <BrazilThemedName>{usuario.nome_completo}</BrazilThemedName>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{usuario.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">{usuario.telefone}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleLogout}
                disabled={submitting}
                className="w-full gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nome.sobrenome@visagio.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="nome.sobrenome"
                  required
                />
              </div>
              {message && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {message}
                </div>
              )}
              <Button type="submit" disabled={submitting} className="w-full gap-2">
                <LogIn className="h-4 w-4" />
                Entrar
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
