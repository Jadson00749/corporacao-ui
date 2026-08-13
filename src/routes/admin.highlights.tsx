import { createFileRoute } from "@tanstack/react-router";
import AdminHighlights from "@/screens/admin/AdminHighlights";

export const Route = createFileRoute("/admin/highlights")({
  head: () => ({
    meta: [
      { title: "Destaques — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHighlights,
});
