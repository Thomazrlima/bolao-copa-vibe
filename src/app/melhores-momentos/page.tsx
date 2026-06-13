import type { Metadata } from "next";

import { TransmissaoDestaques } from "@/components/transmissao/TransmissaoDestaques";

export const metadata: Metadata = {
  title: "Melhores momentos · Bolão dos v(devers)",
  description: "Melhores momentos dos jogos selecionados pela organização do bolão.",
};

export default function MelhoresMomentosPage() {
  return <TransmissaoDestaques pageMode="melhores-momentos" />;
}
