"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Check, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RedefinirSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const response = await fetch("/api/auth/reset-password", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { ready?: boolean } | null;

      if (!active) return;
      setHasRecoverySession(Boolean(body?.ready));
      setCheckingSession(false);
    }

    checkSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("A confirmação da senha não confere.");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setSubmitting(false);

    if (!response.ok) {
      setMessage(body?.error ?? "Não foi possível redefinir a senha.");
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Recuperação de acesso
        </p>
        <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
          Redefinir senha
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma nova senha para voltar ao bolão.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        {checkingSession ? (
          <p className="text-sm text-muted-foreground">Validando link de recuperação...</p>
        ) : success ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <Check className="h-4 w-4" />
              Senha redefinida com sucesso.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Entrar com a nova senha</Link>
            </Button>
          </div>
        ) : hasRecoverySession ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>
            {message && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {message}
              </div>
            )}
            <Button type="submit" disabled={submitting} className="w-full gap-2">
              <KeyRound className="h-4 w-4" />
              {submitting ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este link de recuperação expirou ou já foi usado. Peça um novo e-mail para continuar.
            </p>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/login">Voltar ao login</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
