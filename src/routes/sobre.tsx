import { createFileRoute } from "@tanstack/react-router";
import Sobre from "@/screens/Sobre";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Quem somos — Corporação Running" },
      { name: "description", content: "Conheça a história, a metodologia e o time da Corporação." },
      { property: "og:title", content: "Quem somos — Corporação Running" },
      { property: "og:description", content: "Conheça a história, a metodologia e o time da Corporação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sobre,
});
