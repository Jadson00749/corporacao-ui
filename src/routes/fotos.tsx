import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import Fotos from "@/screens/Fotos";

export const Route = createFileRoute("/fotos")({
  head: () => ({
    meta: buildMeta({
      title: "Galeria de fotos",
      description: "Fotos dos treinos, provas e eventos da equipe.",
      path: "/fotos",
    }),
  }),
  component: Fotos,
});
