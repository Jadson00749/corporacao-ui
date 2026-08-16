import { createFileRoute } from "@tanstack/react-router";
import CompletarCadastro from "@/screens/CompletarCadastro";

export const Route = createFileRoute("/completar-cadastro")({
  head: () => ({
    meta: [
      { title: "Complete seu cadastro — Corporação Running" },
      { name: "description", content: "Finalize seus dados para se inscrever em provas e treinos da Corporação." },
      { property: "og:title", content: "Complete seu cadastro — Corporação Running" },
      { property: "og:description", content: "Finalize seus dados para se inscrever em provas e treinos da Corporação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompletarCadastro,
});
