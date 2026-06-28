"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SpinningBallLoader } from "@/components/common/SpinningBallLoader";
import { ChaveamentoSection } from "@/components/palpites/ChaveamentoSection";
import {
  getPalpiteChaveamento,
  savePalpiteChaveamento,
  type PalpiteChaveamentoResponse,
} from "@/lib/queries";

type SaveMatch = {
  fase_id: number;
  slot: number;
  time1: string;
  time2: string;
  vencedor: string;
};

export default function ChaveamentoDevPage() {
  const [bracket, setBracket] = useState<PalpiteChaveamentoResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setBracket(await getPalpiteChaveamento());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar.");
      }
    }

    void load();
  }, []);

  async function save(confrontos: SaveMatch[]) {
    setSaving(true);
    setError(null);

    try {
      const updated = await savePalpiteChaveamento(confrontos);
      setBracket(updated);
      toast.success("Chaveamento salvo", {
        description: "Suas escolhas do mata-mata foram registradas no banco.",
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar.");
      throw saveError;
    } finally {
      setSaving(false);
    }
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
          Usa o mesmo carregamento e salvamento no banco da tela de palpites.
        </p>
      </div>

      <ChaveamentoSection bracket={bracket} saving={saving} onSave={save} />
    </div>
  );
}
