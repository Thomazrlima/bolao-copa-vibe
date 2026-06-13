import type { Metadata } from "next";

import { BugReportClient } from "./BugReportClient";

export const metadata: Metadata = {
  title: "Reportar bug · Bolão dos v(devers)",
  description: "Envie um bug report para ajudar a melhorar o Bolão dos v(devers).",
};

export default function BugReportPage() {
  return <BugReportClient />;
}
