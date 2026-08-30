// Build estático (SPA) para hospedagem Apache tradicional (HostGator).
// Uso: npm run build:static  ->  gera dist/ com index.html + assets/
// Este arquivo NÃO afeta o dev server nem o build padrão do projeto.
import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  root: resolve(__dirname, "static"),
  publicDir: resolve(__dirname, "public"),
  envDir: __dirname,
  plugins: [react(), tailwindcss(), tsConfigPaths({ root: __dirname })],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
