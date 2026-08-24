import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import Sobre from "@/screens/Sobre";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: buildMeta({
      title: "Quem somos",
      description: "Conheça a história, a metodologia e o time da Corporação.",
      path: "/sobre",
    }),
  }),
  component: Sobre,
});
