import { createFileRoute } from "@tanstack/react-router";
import MinhaConta from "@/screens/MinhaConta";

export const Route = createFileRoute("/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — Corporação Running" },
      { name: "description", content: "Gerencie seus dados e acompanhe suas inscrições." },
      { property: "og:title", content: "Minha conta — Corporação Running" },
      { property: "og:description", content: "Gerencie seus dados e acompanhe suas inscrições." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MinhaConta,
});
