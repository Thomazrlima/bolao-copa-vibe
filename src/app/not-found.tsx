import Link from "next/link";
import { ArrowLeft, CalendarDays, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-[65vh] place-items-center py-10">
      <section className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-primary/25 bg-card px-5 py-12 text-center shadow-2xl sm:px-10">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/12 to-transparent" />

        <div className="relative">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">
            Página não encontrada
          </p>

          <div className="num mt-5 flex items-center justify-center gap-3 font-display text-7xl font-black sm:text-9xl">
            <span>4</span>
            <span className="text-primary">×</span>
            <span>0</span>
            <span className="text-muted-foreground/45">4</span>
          </div>

          <h1 className="mt-5 font-display text-2xl font-black sm:text-3xl">
            Esse jogo não está na tabela
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            O endereço pode ter mudado ou a página deixou de existir. Escolha um caminho abaixo para
            voltar ao bolão.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/jogos">
                <CalendarDays className="h-4 w-4" />
                Ver jogos
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/ranking">
                <Trophy className="h-4 w-4" />
                Ir para o ranking
              </Link>
            </Button>
          </div>

          <Button asChild variant="ghost" className="mt-4">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao início
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
