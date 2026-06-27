"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { ChaveamentoSection } from "@/components/palpites/ChaveamentoSection";
import type { KnockoutBracket } from "@/lib/knockout";
import type { PalpiteChaveamentoResponse } from "@/lib/queries";

type SaveMatch = {
  fase_id: number;
  slot: number;
  time1: string;
  time2: string;
  vencedor: string;
};

const PHASES = [
  { fase_id: 2, nome: "16-avos", total_confrontos: 16, pontuavel: false },
  { fase_id: 3, nome: "Oitavas", total_confrontos: 8, pontuavel: true },
  { fase_id: 4, nome: "Quartas", total_confrontos: 4, pontuavel: true },
  { fase_id: 5, nome: "Semifinal", total_confrontos: 2, pontuavel: true },
  { fase_id: 7, nome: "Final", total_confrontos: 1, pontuavel: true },
];

function createBracketFromCopa(
  mataMata: KnockoutBracket,
  saved: SaveMatch[] = [],
): PalpiteChaveamentoResponse {
  const savedByKey = new Map(saved.map((match) => [`${match.fase_id}:${match.slot}`, match]));

  return {
    disponivel: true,
    aberto: true,
    prazo_envio: null,
    inicial_fase_id: 2,
    salvo: saved.length > 0,
    completo: saved.length === PHASES.reduce((sum, phase) => sum + phase.total_confrontos, 0),
    pontos: 0,
    acertos: 0,
    total_pontuavel: PHASES.filter((phase) => phase.pontuavel).reduce(
      (sum, phase) => sum + phase.total_confrontos,
      0,
    ),
    fases: PHASES.map((phase) => ({
      ...phase,
      confrontos: Array.from({ length: phase.total_confrontos }, (_, slot) => {
        const savedMatch = savedByKey.get(`${phase.fase_id}:${slot}`);
        const initialMatch = phase.fase_id === 2 ? mataMata.r32[slot] : null;

        return {
          fase_id: phase.fase_id,
          fase: phase.nome,
          slot,
          time1: savedMatch?.time1 ?? initialMatch?.time1?.time ?? null,
          time2: savedMatch?.time2 ?? initialMatch?.time2?.time ?? null,
          vencedor: savedMatch?.vencedor ?? null,
          pontos: 0,
          acertou: null,
          calculado_em: null,
        };
      }),
    })),
  };
}

export default function ChaveamentoDevPage() {
  const [mataMata, setMataMata] = useState<KnockoutBracket | null>(null);
  const [bracket, setBracket] = useState<PalpiteChaveamentoResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/mata-mata", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar a chave.");
        setMataMata(body.mataMata);
        setBracket(createBracketFromCopa(body.mataMata));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar.");
      }
    }

    void load();
  }, []);

  async function save(confrontos: SaveMatch[]) {
    if (!mataMata) return;
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    setBracket(createBracketFromCopa(mataMata, confrontos));
    setSaving(false);
    toast.success("Preview salvo", {
      description: "A chave foi atualizada em memória com a projeção atual da Copa.",
    });
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!bracket) return <SpinningBallLoader label="Carregando chave" />;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
          Preview do chaveamento
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Usa os confrontos atuais da tela Copa/mata-mata para testar o palpite de chaveamento.
        </p>
      </div>

      <ChaveamentoSection bracket={bracket} saving={saving} previewMode onSave={save} />
    </div>
  );
}
