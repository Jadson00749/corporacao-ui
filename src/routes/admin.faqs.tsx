import { createFileRoute } from "@tanstack/react-router";
import AdminFaqs from "@/screens/admin/AdminFaqs";

export const Route = createFileRoute("/admin/faqs")({
  head: () => ({
    meta: [
      { title: "FAQ — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminFaqs,
});
