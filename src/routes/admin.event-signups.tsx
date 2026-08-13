import { createFileRoute } from "@tanstack/react-router";
import AdminEventSignups from "@/screens/admin/AdminEventSignups";

export const Route = createFileRoute("/admin/event-signups")({
  head: () => ({
    meta: [
      { title: "Inscrições — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminEventSignups,
});
