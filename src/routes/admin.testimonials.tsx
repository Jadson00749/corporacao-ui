import { createFileRoute } from "@tanstack/react-router";
import AdminTestimonials from "@/screens/admin/AdminTestimonials";

export const Route = createFileRoute("/admin/testimonials")({
  head: () => ({
    meta: [
      { title: "Depoimentos — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTestimonials,
});
