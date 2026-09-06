import { SITE_URL } from "@/lib/seo";

/**
 * Corrige URLs de mídia do proxy Lovable (`/__l5e/...`) para absolutas,
 * para funcionarem fora do ambiente Lovable (ex.: Vercel).
 * Não troca a imagem — só completa o host.
 */
export const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return "";
  const u = url.trim();
  if (!u) return "";

  if (u.startsWith("/__l5e/")) {
    const origin = SITE_URL.replace(/\/$/, "");
    return `${origin}${u}`;
  }

  return u;
};

/** @deprecated use resolveMediaUrl — mantido para chamadas existentes */
export const usableMediaUrl = (url?: string | null): string => resolveMediaUrl(url);
