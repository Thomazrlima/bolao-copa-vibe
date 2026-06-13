import type { Metadata } from "next";

import { TransmissaoDestaques } from "@/components/transmissao/TransmissaoDestaques";

export const metadata: Metadata = {
  title: "Transmissões · Bolão dos v(devers)",
  description: "Jogos em transmissão selecionados pela organização do bolão.",
};

export default function TransmissaoPage() {
  return <TransmissaoDestaques pageMode="transmissao" />;
}
