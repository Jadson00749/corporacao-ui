import { createFileRoute } from "@tanstack/react-router";
import AdminGallery from "@/screens/admin/AdminGallery";

export const Route = createFileRoute("/admin/gallery")({
  head: () => ({
    meta: [
      { title: "Galeria — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminGallery,
});
