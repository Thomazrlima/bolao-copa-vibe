import type { Metadata } from "next";
import { Suspense } from "react";

import { CopaDashboard, CopaDashboardSkeleton } from "@/components/copa/CopaDashboard";
import { enrichMissingPenaltyWinners } from "@/lib/server/knockout-penalty-enrichment";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Copa · Bolão dos v(devers)",
  description: "Classificação dos grupos e chave projetada do mata-mata da Copa do Mundo de 2026.",
};

export default async function CopaPage() {
  const supabase = await createClient();
  const [gruposResult, jogosResult] = await Promise.all([
    supabase
      .from("grupos")
      .select("grupo,time,pontuacao,saldo_gols,gols_pro,gols_contra,updated_at")
      .order("grupo", { ascending: true })
      .order("pontuacao", { ascending: false })
      .order("saldo_gols", { ascending: false })
      .order("gols_pro", { ascending: false }),
    supabase
      .from("jogos")
      .select(
        "id,sportsdb_event_id,fase_id,codigo_mata_mata,time1,time2,data,gols1,gols2,penaltis1,penaltis2,vencedor,encerrado,rodada,placar_status",
      )
      .order("data", { ascending: true }),
  ]);
  const jogos = await enrichMissingPenaltyWinners(jogosResult.data ?? []);

  return (
    <Suspense fallback={<CopaDashboardSkeleton />}>
      <CopaDashboard initialGrupos={gruposResult.data ?? []} initialJogos={jogos} />
    </Suspense>
  );
}
