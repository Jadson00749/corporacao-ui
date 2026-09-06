import { createFileRoute } from "@tanstack/react-router";
import AdminEventStructure from "@/screens/admin/AdminEventStructure";

export const Route = createFileRoute("/admin/event-structure")({
  head: () => ({
    meta: [
      { title: "Locação de Estruturas — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminEventStructure,
});
