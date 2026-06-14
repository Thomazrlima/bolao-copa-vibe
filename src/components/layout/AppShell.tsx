"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Bug,
  Trophy,
  LayoutGrid,
  CalendarDays,
  LogIn,
  ScrollText,
  Goal,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/common/Flag";
import { UserAvatar } from "@/components/common/UserAvatar";
import { teamCodeFromName } from "@/data/iso2";
import { getDisplayName } from "@/lib/display-name";
import { USER_PROFILE_UPDATED_EVENT } from "@/lib/avatar-storage";
import { createClient } from "@/lib/supabase/client";
import { useBrazilGoalCelebration } from "@/hooks/use-brazil-goal-celebration";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";

const TABS = [
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/palpites", label: "Palpites", icon: Goal },
  { to: "/grupos", label: "Copa", icon: LayoutGrid },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/regras", label: "Regras", icon: ScrollText },
];

const FOOTER_NAMES = [
  "Bob Esponja",
  "Rose Paul",
  "Marcão",
  "Renardo Ferrari",
  "Grande Bura",
  "Joãozinho",
  "Rod Sampa",
  "Henrico Leão",
  "Sofia Pinto",
  "Gael Leag",
  "Ono Cloro",
];

const FORCE_BRAZIL_LIVE_THEME =
  process.env.NEXT_PUBLIC_FORCE_BRAZIL_LIVE_THEME?.toLowerCase() === "true";

type Usuario = {
  id: string;
  nome_completo: string;
  avatar_url: string | null;
};

type LiveGame = {
  id: string;
  time1: string;
  time2: string;
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
  placar_status: "upcoming" | "live" | "finished" | null;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [brazilLiveTheme, setBrazilLiveTheme] = useState(FORCE_BRAZIL_LIVE_THEME);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const activePath = pendingPath ?? pathname;
  const currentTab = Math.max(
    0,
    TABS.findIndex(({ to }) => activePath.startsWith(to)),
  );
  const previousTab = useRef(currentTab);
  const direction = currentTab >= previousTab.current ? 1 : -1;

  useEffect(() => {
    previousTab.current = currentTab;
  }, [currentTab]);

  useEffect(() => {
    if (pendingPath && pathname.startsWith(pendingPath)) {
      setPendingPath(null);
    }
  }, [pathname, pendingPath]);

  return (
    <div
      className="app-shell flex min-h-screen flex-col text-foreground"
      data-brazil-live-theme={brazilLiveTheme || undefined}
    >
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2.5 sm:px-6 lg:grid-cols-[minmax(150px,1fr)_minmax(520px,580px)_minmax(150px,1fr)] lg:gap-5 lg:py-3">
          <Link
            href="/ranking"
            className="flex min-w-0 items-center gap-3 py-1 lg:justify-self-start"
          >
            <div className="min-w-0">
              <h1 className="truncate font-display text-base font-black leading-none tracking-tight min-[360px]:text-lg sm:text-xl">
                Bolão dos <span className="text-foreground">v</span>
                <span className="text-primary">(</span>
                <span className="text-foreground">devers</span>
                <span className="text-primary">)</span>
              </h1>
              <p className="hidden text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Copa do Mundo · 2026
              </p>
            </div>
          </Link>

          <DesktopNavigation
            activePath={activePath}
            pathname={pathname}
            reduceMotion={reduceMotion}
            setPendingPath={setPendingPath}
          />

          <div className="justify-self-end">
            <HeaderAuth />
          </div>
        </div>
        <LiveScoreTicker onBrazilThemeChange={setBrazilLiveTheme} />
        <AnimatePresence>
          {pendingPath && (
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 0.82, opacity: 1 }}
              exit={{ scaleX: 1, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
              className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
            />
          )}
        </AnimatePresence>
      </header>

      <motion.main
        key={pathname}
        initial={reduceMotion ? false : { opacity: 0, x: direction * 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-7xl flex-1 px-3 pb-12 pt-5 sm:px-6 lg:py-8"
      >
        {children}
      </motion.main>

      <AppFooter />

      <MobileNavigation
        activePath={activePath}
        pathname={pathname}
        reduceMotion={reduceMotion}
        setPendingPath={setPendingPath}
      />
    </div>
  );
}

function LiveScoreTicker({
  onBrazilThemeChange,
}: {
  onBrazilThemeChange: (active: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState({ copies: 2, distance: 0 });

  const loadLiveGames = useCallback(async () => {
    try {
      const response = await fetch("/api/jogos", { cache: "no-store" });
      if (!response.ok) return;

      const body = (await response.json()) as { jogos?: LiveGame[] };
      const games = body.jogos ?? [];
      const actualLiveGames = games.filter(
        (game) => game.placar_status === "live" && !game.encerrado,
      );
      const previewBrazilGame = FORCE_BRAZIL_LIVE_THEME
        ? (games.find((game) => isBrazilGame(game) && !game.encerrado) ??
          games.find((game) => isBrazilGame(game)))
        : undefined;

      setLiveGames(
        actualLiveGames.length > 0 ? actualLiveGames : previewBrazilGame ? [previewBrazilGame] : [],
      );
    } catch {
      // Keep the latest score visible through brief connection failures.
    }
  }, []);

  useEffect(() => {
    void loadLiveGames();
  }, [loadLiveGames]);

  useRealtimeRefresh({
    channelName: "header-live-scores",
    signals: ["jogos"],
    onRefresh: loadLiveGames,
    fallbackIntervalMs: 60_000,
  });

  useBrazilGoalCelebration(liveGames, {
    reduceMotion,
    previewConfetti: FORCE_BRAZIL_LIVE_THEME,
  });

  const brazilThemeActive = FORCE_BRAZIL_LIVE_THEME || liveGames.some((game) => isBrazilGame(game));

  useEffect(() => {
    onBrazilThemeChange(brazilThemeActive);
  }, [brazilThemeActive, onBrazilThemeChange]);

  useEffect(() => {
    const viewport = marqueeRef.current;
    const group = groupRef.current;
    if (!viewport || !group) return;

    const updateMarquee = () => {
      const distance = group.getBoundingClientRect().width;
      if (distance <= 0) return;

      const copies = Math.max(2, Math.ceil(viewport.clientWidth / distance) + 2);
      setMarquee((current) =>
        current.copies === copies && current.distance === distance ? current : { copies, distance },
      );
    };

    updateMarquee();
    const observer = new ResizeObserver(updateMarquee);
    observer.observe(viewport);
    observer.observe(group);

    return () => observer.disconnect();
  }, [liveGames]);

  const marqueeStyle = {
    "--live-score-distance": `${marquee.distance}px`,
    "--live-score-duration": `${Math.max(14, marquee.distance / 16)}s`,
  } as CSSProperties;

  return (
    <AnimatePresence initial={false}>
      {liveGames.length > 0 ? (
        <motion.div
          key="live-score-ticker"
          initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0, y: -12 }}
          animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { height: 0, opacity: 0, y: -12, transition: { duration: 0.32 } }
          }
          transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "overflow-hidden text-white",
            brazilThemeActive
              ? "bg-[linear-gradient(90deg,#006b2d_0%,#009c3b_42%,#8cbd1f_50%,#ffdf00_58%,#ffdf00_100%)] shadow-[0_8px_26px_rgba(0,156,59,0.3)]"
              : "bg-live shadow-[0_8px_24px_rgba(170,20,30,0.24)]",
          )}
          role="status"
          aria-live="polite"
          aria-label={liveGames.map(liveGameLabel).join(". ")}
        >
          <div
            className="relative flex min-h-10 items-center overflow-hidden"
            data-brazil-live-score-bar={brazilThemeActive || undefined}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 z-10 flex items-center gap-1.5 px-3 sm:px-5",
                brazilThemeActive
                  ? "bg-[#006b2d] shadow-[10px_0_18px_#006b2d]"
                  : "bg-live shadow-[10px_0_18px_var(--live)]",
              )}
            >
              {brazilThemeActive && (
                <Flag code={teamCodeFromName("Brasil")} name="Brasil" size="sm" static />
              )}
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] sm:text-xs">
                Ao vivo
              </span>
              {brazilThemeActive && (
                <Flag code={teamCodeFromName("Brasil")} name="Brasil" size="sm" static />
              )}
            </div>

            <div
              ref={marqueeRef}
              className={cn(
                "live-score-marquee min-w-0 flex-1",
                brazilThemeActive ? "ml-[148px] sm:ml-[168px]" : "ml-[88px] sm:ml-[108px]",
              )}
            >
              <div className="live-score-track" style={marqueeStyle}>
                {Array.from({ length: marquee.copies }, (_, index) => (
                  <LiveScoreGroup
                    key={index}
                    games={liveGames}
                    hidden={index > 0}
                    groupRef={index === 0 ? groupRef : undefined}
                  />
                ))}
              </div>
            </div>

            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent",
                brazilThemeActive ? "from-[#ffdf00]" : "from-live",
              )}
              aria-hidden
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function LiveScoreGroup({
  games,
  hidden = false,
  groupRef,
}: {
  games: LiveGame[];
  hidden?: boolean;
  groupRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={groupRef} className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {games.map((game) => (
        <LiveScoreItem
          key={`${hidden ? "copy-" : ""}${game.id}`}
          game={game}
          hidden={hidden}
        />
      ))}
    </div>
  );
}

function LiveScoreItem({
  game,
  hidden,
}: {
  game: LiveGame;
  hidden: boolean;
}) {
  return (
    <Link
      href={`/calendario/${game.id}`}
      tabIndex={hidden ? -1 : undefined}
      onClick={(event) => event.currentTarget.blur()}
      className="group relative flex h-10 shrink-0 items-center text-xs font-bold text-white hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white sm:text-sm"
    >
      <LiveScoreContent game={game} />
    </Link>
  );
}

function LiveScoreContent({ game }: { game: LiveGame }) {
  return (
    <span className="flex h-10 shrink-0 items-center gap-2 px-5 sm:gap-3 sm:px-8">
      <Radio className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <LiveTeamName name={game.time1} />
      <strong className="num rounded-md bg-black/20 px-2 py-0.5 font-display text-sm font-black tracking-wide sm:text-base">
        {formatLiveScore(game.gols1)} × {formatLiveScore(game.gols2)}
      </strong>
      <LiveTeamName name={game.time2} />
      <span className="ml-2 h-4 w-px bg-current opacity-35" aria-hidden />
    </span>
  );
}

function LiveTeamName({ name }: { name: string }) {
  return isBrazilTeam(name) ? (
    <strong className="font-black drop-shadow-sm">{name}</strong>
  ) : (
    <span>{name}</span>
  );
}

function isBrazilGame(game: LiveGame) {
  return isBrazilTeam(game.time1) || isBrazilTeam(game.time2);
}

function isBrazilTeam(team: string) {
  const normalizedTeam = team.trim().toLocaleLowerCase("pt-BR");
  return normalizedTeam === "brasil" || normalizedTeam === "brazil";
}

function formatLiveScore(score: number | null) {
  return score ?? "–";
}

function liveGameLabel(game: LiveGame) {
  return `${game.time1} ${formatLiveScore(game.gols1)} a ${formatLiveScore(game.gols2)} ${game.time2}`;
}

function AppFooter() {
  const reduceMotion = useReducedMotion();
  const [nameIndex, setNameIndex] = useState(0);
  const currentName = FOOTER_NAMES[nameIndex];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNameIndex((current) => (current + 1) % FOOTER_NAMES.length);
    }, 2400);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <footer className="mx-auto mt-auto w-full max-w-7xl px-3 pb-28 sm:px-6 lg:pb-8">
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-x-1">
          <span>© 2026</span>
          <span className="relative inline-grid h-5 min-w-[112px] overflow-hidden text-center align-middle">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={currentName}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
                transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 font-semibold text-primary"
              >
                {currentName}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="font-semibold text-foreground">All rights reserved.</span>
        </p>
        <Button asChild size="sm" className="w-full justify-center sm:w-auto">
          <Link href="/bug-report">
            <Bug className="h-3.5 w-3.5" />
            Reportar bug
          </Link>
        </Button>
      </div>
    </footer>
  );
}

type NavigationProps = {
  activePath: string;
  pathname: string;
  reduceMotion: boolean | null;
  setPendingPath: (path: string) => void;
};

function DesktopNavigation(props: NavigationProps) {
  return (
    <nav className="hidden min-w-0 lg:block">
      <NavigationItems {...props} desktop />
    </nav>
  );
}

function MobileNavigation(props: NavigationProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 shadow-[0_-10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:hidden">
      <NavigationItems {...props} />
    </nav>
  );
}

function NavigationItems({
  activePath,
  pathname,
  reduceMotion,
  setPendingPath,
  desktop = false,
}: NavigationProps & { desktop?: boolean }) {
  return (
    <div className={cn("grid grid-cols-5", desktop ? "gap-1" : "mx-auto max-w-lg gap-1")}>
      {TABS.map(({ to, label, icon: Icon }) => {
        const active = activePath.startsWith(to);

        return (
          <Link
            key={to}
            href={to}
            onClick={() => {
              if (!pathname.startsWith(to)) setPendingPath(to);
            }}
            className={cn(
              "group relative flex min-w-0 items-center justify-center font-bold transition-colors",
              desktop
                ? "min-h-10 gap-1.5 rounded-xl px-2 py-2 text-sm"
                : "flex-col gap-1 rounded-xl px-0.5 py-1.5 text-[10px]",
              active
                ? desktop
                  ? "text-primary-foreground"
                  : "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-card hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={desktop ? "desktop-navigation-tab" : "mobile-navigation-tab"}
                className={cn(
                  "absolute bg-primary",
                  desktop ? "inset-0 rounded-xl" : "-top-1.5 h-0.5 w-8 rounded-full",
                )}
                transition={{
                  duration: reduceMotion ? 0 : 0.18,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            )}
            <Icon className="relative z-10 h-4 w-4 shrink-0" />
            <span className="relative z-10 whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
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
    window.addEventListener(USER_PROFILE_UPDATED_EVENT, loadUsuario);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener(USER_PROFILE_UPDATED_EVENT, loadUsuario);
    };
  }, [supabase.auth]);

  if (loading) {
    return (
      <div
        className="h-9 w-20 shrink-0 rounded-md border border-border bg-card/60 sm:w-24"
        aria-hidden
      />
    );
  }

  if (!usuario) {
    return (
      <Button asChild variant="secondary" size="sm" className="shrink-0 gap-1.5">
        <Link href="/login">
          <LogIn className="h-3.5 w-3.5" />
          Login
        </Link>
      </Button>
    );
  }

  const displayName = usuario.nome_completo;
  const navigationName = getDisplayName(displayName);

  return (
    <Link
      href={`/perfil/${encodeURIComponent(usuario.id)}`}
      className="group flex min-w-0 shrink-0 items-center justify-end gap-2 rounded-full p-1 pr-1 transition-colors hover:bg-card sm:rounded-md sm:pr-2"
      aria-label={`Abrir perfil de ${displayName}`}
    >
      <span className="hidden max-w-[120px] truncate text-sm font-semibold group-hover:text-primary min-[400px]:block sm:max-w-[160px]">
        {navigationName}
      </span>
      <UserAvatar
        name={displayName}
        avatarPath={usuario.avatar_url}
        className="h-8 w-8 border border-primary/40 bg-primary/10"
        fallbackClassName="bg-primary/15 text-xs font-black text-primary"
      />
    </Link>
  );
}
