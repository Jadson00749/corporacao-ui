import { createFileRoute } from "@tanstack/react-router";
import MinhaConta from "@/screens/MinhaConta";

export const Route = createFileRoute("/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha Corporação — Corporação Running" },
      { name: "description", content: "Gerencie seus dados, treinos, provas e inscrições na Corporação." },
      { property: "og:title", content: "Minha Corporação — Corporação Running" },
      { property: "og:description", content: "Gerencie seus dados, treinos, provas e inscrições na Corporação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MinhaConta,
});
