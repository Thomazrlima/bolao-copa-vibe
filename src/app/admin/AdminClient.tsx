"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { AlertCircle, Bug, Check, Loader2, Settings, UserPlus } from "lucide-react";

import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canManageUsers } from "@/lib/admin-users";
import { createUsuario, getCurrentUsuario, type Usuario } from "@/lib/queries";

type CreatedUser = {
  email: string;
  temporaryPassword: string;
  emailConfirmationRequired: boolean;
};

type BugReport = {
  id: string;
  user_id: string | null;
  nome: string | null;
  email: string;
  pagina: string | null;
  descricao: string;
  passos: string | null;
  esperado: string | null;
  atual: string | null;
  navegador: string | null;
  status: string;
  criado_em: string;
};

export function AdminClient() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reports, setReports] = useState<BugReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [userCreating, setUserCreating] = useState(false);
  const [userCreationError, setUserCreationError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const currentUser = await getCurrentUsuario();
        if (!active) return;
        setUsuario(currentUser);

        if (currentUser && canManageUsers(currentUser.email)) {
          await loadReports();
        }
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Não foi possível carregar a área.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  async function loadReports() {
    setReportsLoading(true);
    setReportsError(null);

    try {
      const response = await fetch("/api/admin/bug-reports", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível carregar os bug reports.");
      }

      setReports(body.reports ?? []);
    } catch (error) {
      setReportsError(
        error instanceof Error ? error.message : "Não foi possível carregar reports.",
      );
    } finally {
      setReportsLoading(false);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserCreating(true);
    setUserCreationError(null);
    setCreatedUser(null);

    try {
      const result = await createUsuario({
        email: newUserEmail.trim(),
        nome_completo: newUserName.trim(),
        telefone: newUserPhone.trim(),
      });

      setCreatedUser({
        email: result.usuario.email,
        temporaryPassword: result.temporary_password,
        emailConfirmationRequired: result.email_confirmation_required,
      });
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPhone("");
    } catch (error) {
      setUserCreationError(
        error instanceof Error ? error.message : "Não foi possível adicionar o usuário.",
      );
    } finally {
      setUserCreating(false);
    }
  }

  if (loading) {
    return <SpinningBallLoader label="Carregando administração" />;
  }

  if (loadError || !usuario) {
    return (
      <AdminMessage
        title="Acesso indisponível"
        message={loadError ?? "Entre na sua conta para acessar a administração."}
      />
    );
  }

  if (!canManageUsers(usuario.email)) {
    return (
      <AdminMessage
        title="Sem permissão"
        message="Seu usuário não tem acesso à área administrativa."
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Administração</p>
        <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
          Painel administrativo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie participantes e acompanhe os bugs reportados.
        </p>
      </header>

      <div className="grid gap-5">
        <form
          onSubmit={handleCreateUser}
          className="rounded-xl border border-primary/30 bg-card p-4 sm:p-6"
        >
          <SectionHeader
            icon={UserPlus}
            title="Adicionar usuário"
            description="O novo participante começa com pontos e chineladas zerados."
          />

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="new-user-email">E-mail</Label>
              <Input
                id="new-user-email"
                type="email"
                value={newUserEmail}
                onChange={(event) => setNewUserEmail(event.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Nome completo</Label>
              <Input
                id="new-user-name"
                value={newUserName}
                onChange={(event) => setNewUserName(event.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-phone">Telefone</Label>
              <Input
                id="new-user-phone"
                value={newUserPhone}
                onChange={(event) => setNewUserPhone(event.target.value)}
                type="tel"
                inputMode="tel"
                placeholder="+5581979142974"
                autoComplete="off"
                required
              />
            </div>
          </div>

          {userCreationError ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {userCreationError}
            </p>
          ) : null}

          {createdUser ? (
            <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-success">
                <Check className="h-4 w-4" />
                Usuário {createdUser.email} criado.
              </p>
              <p className="mt-2 text-muted-foreground">
                Senha inicial:{" "}
                <strong className="select-all font-mono text-foreground">
                  {createdUser.temporaryPassword}
                </strong>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                A senha inicial é a parte do e-mail antes do @.
              </p>
              {createdUser.emailConfirmationRequired ? (
                <p className="mt-2 text-xs font-medium text-foreground">
                  O participante precisa confirmar o e-mail antes do primeiro acesso.
                </p>
              ) : null}
            </div>
          ) : null}

          <Button type="submit" disabled={userCreating} className="mt-5 w-full sm:w-auto">
            {userCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {userCreating ? "Adicionando..." : "Adicionar usuário"}
          </Button>
        </form>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SectionHeader
              icon={Bug}
              title="Bug reports"
              description="Últimos relatos enviados pelo formulário do site."
              className="mb-0"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={loadReports}
              disabled={reportsLoading}
              className="w-full sm:w-auto"
            >
              {reportsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Atualizar
            </Button>
          </div>

          {reportsError ? (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {reportsError}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {reportsLoading && reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">Carregando reports...</p>
            ) : reports.length ? (
              reports.map((report) => <BugReportCard key={report.id} report={report} />)
            ) : (
              <p className="rounded-lg border border-border bg-background/50 p-4 text-sm text-muted-foreground">
                Nenhum bug report enviado ainda.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-4xl rounded-xl border border-destructive/40 bg-destructive/10 p-6">
      <AlertCircle className="mb-3 h-6 w-6 text-destructive" />
      <h2 className="font-display text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm text-destructive" role="alert">
        {message}
      </p>
      <Button asChild variant="secondary" className="mt-4">
        <Link href="/configuracoes">Voltar às configurações</Link>
      </Button>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: typeof Settings;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={`mb-5 flex items-center gap-3 ${className ?? ""}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-display text-lg font-black">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function BugReportCard({ report }: { report: BugReport }) {
  return (
    <article className="rounded-lg border border-border bg-background/50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display font-black">{report.nome ?? report.email}</h4>
            <Badge variant="secondary">{report.status}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {report.email} · {formatDateTime(report.criado_em)}
          </p>
        </div>
        {report.pagina ? (
          <span className="rounded-full border border-border bg-card px-2 py-1 text-xs font-bold text-muted-foreground">
            {report.pagina}
          </span>
        ) : null}
      </div>

      <ReportField label="O que aconteceu?" value={report.descricao} />
      <ReportField label="Como reproduzir" value={report.passos} />
      <ReportField label="Esperado" value={report.esperado} />
      <ReportField label="Atual" value={report.atual} />
      <ReportField label="Navegador" value={report.navegador} compact />
    </article>
  );
}

function ReportField({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | null;
  compact?: boolean;
}) {
  if (!value) return null;

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/85">{value}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
