import { createFileRoute } from "@tanstack/react-router";
import Fotos from "@/screens/Fotos";

export const Route = createFileRoute("/fotos")({
  head: () => ({
    meta: [
      { title: "Galeria de fotos — Corporação Running" },
      { name: "description", content: "Fotos dos treinos, provas e eventos da equipe." },
      { property: "og:title", content: "Galeria de fotos — Corporação Running" },
      { property: "og:description", content: "Fotos dos treinos, provas e eventos da equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Fotos,
});
