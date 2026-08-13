import { createFileRoute } from "@tanstack/react-router";
import Agenda from "@/screens/Agenda";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Corporação Running" },
      { name: "description", content: "Calendário com todos os treinos e provas do mês." },
      { property: "og:title", content: "Agenda — Corporação Running" },
      { property: "og:description", content: "Calendário com todos os treinos e provas do mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Agenda,
});
