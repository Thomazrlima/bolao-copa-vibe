import type { Metadata } from "next";
import {
  Check,
  CircleHelp,
  Crown,
  Flame,
  Goal,
  Lock,
  Sparkles,
  TimerReset,
  Trophy,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Regras · Bolão dos v(devers)",
  description: "Entenda como funciona a pontuação do Bolão dos v(devers).",
};

const RULES = [
  {
    points: 10,
    name: "Chinelada",
    icon: Trophy,
    accent: "text-primary",
    border: "border-primary/45",
    background: "bg-primary/10",
    iconBackground: "bg-primary text-primary-foreground",
    description: "Acertar o vencedor ou empate e o placar exato dos dois times.",
  },
  {
    points: 7,
    name: "Na trave",
    icon: Flame,
    accent: "text-warning",
    border: "border-warning/35",
    background: "bg-warning/10",
    iconBackground: "bg-warning text-primary-foreground",
    description: (
      <>
        Acertar o vencedor, perdedor ou empate <strong>E</strong> também o número de gols de um dos
        times <strong>OU</strong> a diferença de gols da partida.
      </>
    ),
    examples: [
      { guess: "2 x 1", result: "2 x 0" },
      { guess: "3 x 1", result: "2 x 0" },
      { guess: "1 x 1", result: "0 x 0" },
    ],
  },
  {
    points: 5,
    name: "Só o básico",
    icon: Check,
    accent: "text-success",
    border: "border-success/35",
    background: "bg-success/10",
    iconBackground: "bg-success text-primary-foreground",
    description: (
      <>
        Acertar apenas o vencedor ou perdedor, sem acertar o placar de nenhum dos times{" "}
        <strong>E</strong> sem acertar a diferença de gols.
      </>
    ),
    examples: [{ guess: "3 x 0", result: "2 x 1" }],
  },
  {
    points: 2,
    name: "Deu sorte",
    icon: Goal,
    accent: "text-foreground",
    border: "border-border",
    background: "bg-card",
    iconBackground: "bg-secondary text-secondary-foreground",
    description:
      "Acertar apenas o número de gols de um dos times, sem acertar o vencedor, perdedor ou empate.",
    examples: [{ guess: "2 x 1", result: "2 x 3" }],
  },
  {
    points: 0,
    name: "Sabe nada",
    icon: CircleHelp,
    accent: "text-destructive",
    border: "border-destructive/35",
    background: "bg-destructive/10",
    iconBackground: "bg-destructive text-destructive-foreground",
    description:
      "Parabéns, você entende o mesmo que um comentarista da suposta mídia especializada.",
  },
] as const;

const KNOCKOUT_MULTIPLIERS = [
  { phase: "16 avos", multiplier: "1.2x" },
  { phase: "Oitavas", multiplier: "1.4x" },
  { phase: "Quartas", multiplier: "2x" },
  { phase: "Semifinal", multiplier: "3x" },
  { phase: "Final", multiplier: "4x" },
] as const;

export default function RegrasPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7 sm:mb-9">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-primary">
          Manual da resenha
        </p>
        <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
          Regras de pontuação
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Do palpite perfeito ao completo desastre: veja quantos pontos cada resultado vale.
        </p>
      </header>

      <section className="mb-7 overflow-hidden rounded-2xl border border-primary/40 bg-primary/10 sm:mb-9">
        <div className="border-b border-primary/25 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                Pontuação extra
              </p>
              <h3 className="font-display text-xl font-black uppercase tracking-tight sm:text-2xl">
                Palpites Especiais
              </h3>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/85 sm:text-base">
            Além dos jogos, os acertos nos Palpites Especiais também valem pontos no ranking.
          </p>
        </div>

        <div className="grid gap-px bg-primary/25 sm:grid-cols-2">
          <div className="flex items-center gap-4 bg-background/80 p-4 sm:p-6">
            <div className="text-center">
              <div className="font-display text-3xl font-black text-primary num">15</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                pontos
              </div>
            </div>
            <p className="text-sm leading-relaxed text-foreground/85 sm:text-base">
              Por cada <strong>Palpite Especial</strong> acertado.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-background/80 p-4 sm:p-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning text-primary-foreground">
              <Crown className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="font-display text-3xl font-black text-warning num">25 pontos</div>
              <p className="mt-1 text-sm leading-relaxed text-foreground/85 sm:text-base">
                Ao acertar o <strong>Bolão dos Bolões</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-7 overflow-hidden rounded-2xl border border-border bg-card sm:mb-9">
        <div className="border-b border-border px-4 py-5 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            Mata-mata
          </p>
          <h3 className="mt-1 font-display text-xl font-black uppercase tracking-tight sm:text-2xl">
            Palpites fechados, pontos turbinados
          </h3>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-3">
          <RuleNote
            icon={Lock}
            title="Palpites ocultos"
            description="Antes da bola rolar, cada participante vê apenas o próprio palpite. Todo mundo enxerga tudo quando o jogo fica ao vivo."
          />
          <RuleNote
            icon={TimerReset}
            title="Prorrogação conta"
            description="Se tiver tempo extra, vale o placar ao fim dos 120 minutos. Disputa de pênaltis não soma gols ao placar do bolão."
          />
          <RuleNote
            icon={TrendingUp}
            title="Multiplicador"
            description="A base de pontos continua igual, mas recebe multiplicador por fase e sempre arredonda para baixo."
          />
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-5">
          {KNOCKOUT_MULTIPLIERS.map((item) => (
            <div key={item.phase} className="bg-background/80 p-4 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                {item.phase}
              </div>
              <div className="num mt-1 font-display text-2xl font-black text-primary">
                {item.multiplier}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-4">
        {RULES.map((rule) => {
          const Icon = rule.icon;

          return (
            <section
              key={rule.points}
              className={cn("overflow-hidden rounded-2xl border", rule.border, rule.background)}
            >
              <div className="grid sm:grid-cols-[150px_minmax(0,1fr)]">
                <div className="flex items-center gap-4 border-b border-inherit p-4 sm:flex-col sm:justify-center sm:gap-2 sm:border-b-0 sm:border-r sm:p-6 sm:text-center">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      rule.iconBackground,
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className={cn("font-display text-3xl font-black num", rule.accent)}>
                      {rule.points}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      pontos
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <h3
                    className={cn(
                      "font-display text-xl font-black uppercase tracking-tight",
                      rule.accent,
                    )}
                  >
                    {rule.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/85 sm:text-base">
                    {rule.description}
                  </p>

                  {"examples" in rule && (
                    <div className="mt-5">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        {rule.examples.length > 1 ? "Exemplos" : "Exemplo"}
                      </p>
                      <div className="grid gap-2 md:grid-cols-3">
                        {rule.examples.map((example) => (
                          <div
                            key={`${example.guess}-${example.result}`}
                            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-border/70 bg-background/55 px-3 py-2.5 text-center"
                          >
                            <Score label="Palpite" value={example.guess} />
                            <span className="text-muted-foreground" aria-hidden="true">
                              →
                            </span>
                            <Score label="Resultado" value={example.result} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RuleNote({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Lock;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-background/80 p-4 sm:p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h4 className="font-display text-base font-black uppercase tracking-tight">{title}</h4>
      <p className="mt-2 text-sm leading-relaxed text-foreground/80">{description}</p>
    </div>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 whitespace-nowrap font-display text-base font-black num">{value}</div>
    </div>
  );
}
