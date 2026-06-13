"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Bug, CheckCircle2, Loader2, LogIn } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { BrazilThemedName } from "@/components/common/BrazilThemedName";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Status = "idle" | "sending" | "success" | "error";

type FormState = {
  pagina: string;
  descricao: string;
  passos: string;
  esperado: string;
  atual: string;
};

type Usuario = {
  nome_completo: string;
  email: string;
};

const INITIAL_FORM: FormState = {
  pagina: "",
  descricao: "",
  passos: "",
  esperado: "",
  atual: "",
};

export function BugReportClient() {
  const reduceMotion = useReducedMotion();
  const [form, setForm] = useState(INITIAL_FORM);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loadingUsuario, setLoadingUsuario] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadUsuario() {
      try {
        const response = await fetch("/api/usuarios/me", { cache: "no-store" });
        if (response.status === 401) return;

        const body = await response.json();
        if (active) {
          setUsuario({
            nome_completo: body.usuario?.nome_completo ?? "",
            email: body.usuario?.email ?? "",
          });
        }
      } catch {
        if (active) setUsuario(null);
      } finally {
        if (active) setLoadingUsuario(false);
      }
    }

    loadUsuario();

    return () => {
      active = false;
    };
  }, []);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          navegador: navigator.userAgent,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível enviar o bug report.");
      }

      setForm(INITIAL_FORM);
      setStatus("success");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível enviar o bug report.",
      );
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="mb-6 sm:mb-8"
      >
        <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-primary">
          Bug report
        </p>
        <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
          Encontrou algo estranho?
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Manda o relato por aqui. Quanto mais contexto, mais rápido fica para ajustar o bolão.
        </p>
      </motion.header>

      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.24, delay: reduceMotion ? 0 : 0.05 }}
        className="overflow-hidden rounded-2xl border border-primary/35 bg-primary/10"
      >
        <div className="border-b border-primary/25 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Bug className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  Formulário
                </p>
                <h3 className="font-display text-xl font-black uppercase tracking-tight sm:text-2xl">
                  Reportar bug
                </h3>
              </div>
            </div>

            {usuario ? (
              <p className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                Enviando como <BrazilThemedName>{usuario.nome_completo}</BrazilThemedName>
              </p>
            ) : null}
          </div>
        </div>

        {!loadingUsuario && !usuario ? (
          <div className="bg-primary/15 p-4 sm:p-6">
            <div className="rounded-xl border border-primary/35 bg-background/85 p-5 text-center">
              <LogIn className="mx-auto h-8 w-8 text-primary" />
              <h4 className="mt-3 font-display text-xl font-black">Entre para reportar bugs</h4>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                O bug report fica vinculado ao seu usuário para facilitar o acompanhamento.
              </p>
              <Button asChild className="mt-4">
                <Link href="/login">Fazer login</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 bg-background/80 p-4 sm:p-6">
            <Field label="Página onde aconteceu">
              <Input
                value={form.pagina}
                onChange={(event) => updateField("pagina", event.target.value)}
                placeholder="/palpites, /ranking, calendário..."
                maxLength={220}
              />
            </Field>

            <Field label="O que aconteceu?" required>
              <Textarea
                value={form.descricao}
                onChange={(event) => updateField("descricao", event.target.value)}
                placeholder="Descreva o erro com o máximo de contexto que lembrar."
                className="min-h-28 resize-none"
                maxLength={2000}
                required
              />
            </Field>

            <Field label="Como reproduzir">
              <Textarea
                value={form.passos}
                onChange={(event) => updateField("passos", event.target.value)}
                placeholder="Ex.: abri a página X, cliquei em Y, apareceu Z."
                className="min-h-24 resize-none"
                maxLength={2000}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="O que você esperava?">
                <Textarea
                  value={form.esperado}
                  onChange={(event) => updateField("esperado", event.target.value)}
                  placeholder="O comportamento esperado."
                  className="min-h-24 resize-none"
                  maxLength={1200}
                />
              </Field>

              <Field label="O que apareceu no lugar?">
                <Textarea
                  value={form.atual}
                  onChange={(event) => updateField("atual", event.target.value)}
                  placeholder="Mensagem de erro, tela travada, dado incorreto..."
                  className="min-h-24 resize-none"
                  maxLength={1200}
                />
              </Field>
            </div>

            {status === "success" ? (
              <div className="flex items-center gap-2 rounded-xl border border-success/35 bg-success/10 px-4 py-3 text-sm font-bold text-success">
                <CheckCircle2 className="h-4 w-4" />
                Bug report enviado. Valeu por ajudar a arrumar a casa.
              </div>
            ) : null}

            {status === "error" && error ? (
              <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Campos com <span className="text-primary">*</span> são obrigatórios.
              </p>
              <Button
                type="submit"
                disabled={status === "sending" || loadingUsuario}
                className="w-full sm:w-auto"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando
                  </>
                ) : (
                  "Enviar bug report"
                )}
              </Button>
            </div>
          </form>
        )}
      </motion.section>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      <span>
        {label} {required ? <span className="text-primary">*</span> : null}
      </span>
      {children}
    </label>
  );
}
