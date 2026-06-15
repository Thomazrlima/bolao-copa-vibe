import type { Metadata } from "next";

import { AppShell } from "@/components/layout/AppShell";
import "@/styles.css";

export const metadata: Metadata = {
  title: "Bolão dos v(devers) · 2026",
  description:
    "Dashboard do Bolão dos v(devers): ranking ao vivo, grupos, jogos e simulador do mata-mata da Copa de 48 seleções.",
  openGraph: {
    title: "Bolão dos v(devers)",
    description: "Ranking, grupos, jogos e simulador do mata-mata da Copa do Mundo de 48 seleções.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700;800&display=swap"
        />
      </head>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
