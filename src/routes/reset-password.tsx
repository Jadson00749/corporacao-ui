import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import ResetPassword from "@/screens/ResetPassword";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: buildMeta({
      title: "Redefinir senha",
      description: "Redefina a senha da sua conta na Corporação Assessoria Esportiva.",
      path: "/reset-password",
    }),
  }),
  component: ResetPassword,
});
