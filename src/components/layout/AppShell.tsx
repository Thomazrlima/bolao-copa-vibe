"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Trophy, LayoutGrid, CalendarDays, Network, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";

const TABS = [
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/grupos", label: "Grupos", icon: LayoutGrid },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/mata-mata", label: "Mata-Mata", icon: Network },
];

type Usuario = {
  nome_completo: string;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-4">
          <Link href="/ranking" className="flex shrink-0 items-center gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-lg font-black leading-none tracking-tight sm:text-xl">
                Bolão dos <span className="text-foreground">v</span>
                <span className="text-primary">(</span>
                <span className="text-foreground">devers</span>
                <span className="text-primary">)</span>
              </h1>
              <p className="hidden text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Copa do Mundo · 48 seleções
              </p>
            </div>
          </Link>

          <nav className="flex-1 lg:flex lg:justify-center">
            <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
              {TABS.map(({ to, label, icon: Icon }) => {
                const active = pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    href={to}
                    className={cn(
                      "group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-card hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <HeaderAuth />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-center text-xs text-muted-foreground sm:px-6">
        Bolão dos v(devers) · pontuação: 5 placar exato · 2 vencedor · 0 erro
      </footer>
    </div>
  );
}

function HeaderAuth() {
  const supabase = useMemo(() => createClient(), []);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUsuario() {
    const response = await fetch("/api/usuarios/me", { cache: "no-store" });

    if (response.status === 401) {
      setUsuario(null);
      return;
    }

    const body = await response.json();
    setUsuario(body.usuario ?? null);
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

  async function handleLogout() {
    await supabase.auth.signOut();
    setUsuario(null);
  }

  if (loading) {
    return (
      <div className="h-9 w-24 shrink-0 rounded-lg border border-border bg-card/60" aria-hidden />
    );
  }

  if (!usuario) {
    return (
      <Button
        asChild
        variant="secondary"
        size="sm"
        className="shrink-0 gap-1.5 self-end lg:self-auto"
      >
        <Link href="/login">
          <LogIn className="h-3.5 w-3.5" />
          Login
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
      <span className="max-w-[160px] truncate text-sm font-semibold">{usuario.nome_completo}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="gap-1.5 text-xs"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </div>
  );
}
