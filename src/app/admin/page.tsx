import type { Metadata } from "next";

import { AdminClient } from "./AdminClient";

export const metadata: Metadata = {
  title: "Administração · Bolão dos v(devers)",
  description: "Área administrativa do Bolão dos v(devers).",
};

export default function AdminPage() {
  return <AdminClient />;
}
