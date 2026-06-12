import type { Metadata } from "next";
import { Suspense } from "react";

import { CopaDashboard, CopaDashboardSkeleton } from "@/components/copa/CopaDashboard";

export const metadata: Metadata = {
  title: "Copa · Bolão dos v(devers)",
  description: "Classificação dos grupos e chave projetada do mata-mata da Copa do Mundo de 2026.",
};

export default function CopaPage() {
  return (
    <Suspense fallback={<CopaDashboardSkeleton />}>
      <CopaDashboard />
    </Suspense>
  );
}
