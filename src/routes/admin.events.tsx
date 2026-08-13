import { createFileRoute } from "@tanstack/react-router";
import AdminEvents from "@/screens/admin/AdminEvents";

export const Route = createFileRoute("/admin/events")({
  head: () => ({
    meta: [
      { title: "Provas — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminEvents,
});
