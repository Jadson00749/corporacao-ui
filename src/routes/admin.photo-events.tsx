import { createFileRoute } from "@tanstack/react-router";
import AdminPhotoEvents from "@/screens/admin/AdminPhotoEvents";

export const Route = createFileRoute("/admin/photo-events")({
  head: () => ({
    meta: [
      { title: "Eventos de fotos — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPhotoEvents,
});
