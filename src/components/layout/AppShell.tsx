import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Trophy, LayoutGrid, CalendarDays, Network, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBolaoStore } from "@/lib/store";

const TABS = [
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/grupos", label: "Grupos", icon: LayoutGrid },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/mata-mata", label: "Mata-Mata", icon: Network },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reset = useBolaoStore((s) => s.reset);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/ranking" className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg font-black">
              v
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-black leading-none tracking-tight sm:text-xl">
                Bolão dos <span className="text-primary">v(devers)</span>
              </h1>
              <p className="hidden text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Copa do Mundo · 48 seleções
              </p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Resetar todos os resultados para o mock inicial?"))
                reset();
            }}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Resetar</span>
          </Button>
        </div>

        <nav className="mx-auto max-w-7xl px-2 sm:px-4">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {TABS.map(({ to, label, icon: Icon }) => {
              const active = pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
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
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-center text-xs text-muted-foreground sm:px-6">
        Bolão dos v(devers) · pontuação: 5 placar exato · 2 vencedor · 0 erro
      </footer>
    </div>
  );
}
