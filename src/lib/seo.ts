/**
 * Identidade global de compartilhamento — Corporação Assessoria Esportiva.
 * Centraliza título, descrição e imagem de compartilhamento de todas as rotas
 * públicas, evitando qualquer metadata genérica/automática.
 */

export const SITE_NAME = "Corporação Assessoria Esportiva";
export const SITE_URL = "https://novacorporacao.lovable.app";
export const SITE_TITLE = SITE_NAME;
export const SITE_DESCRIPTION =
  "Assessoria de corrida: treinos, provas, planos e produtos da Corporação.";
/** Asset oficial da Corporação (1200x630) usado como fallback de compartilhamento. */
export const SITE_OG_IMAGE = `${SITE_URL}/og-corporacao.jpg`;

export const absoluteUrl = (path = "/") => {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

export const pageTitle = (title?: string) =>
  title && title.trim() ? `${title} | ${SITE_NAME}` : SITE_TITLE;

type MetaInput = {
  /** Título específico da página (sem o sufixo da marca). */
  title?: string;
  description?: string;
  /** Caminho da rota, ex.: "/provas". */
  path?: string;
  /** Imagem de compartilhamento (absoluta ou caminho local). Nunca usar asset de terceiros. */
  image?: string;
  type?: "website" | "article";
};

/** Gera o array de meta tags de uma rota, sempre com identidade da Corporação. */
export const buildMeta = ({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
  image,
  type = "website",
}: MetaInput = {}) => {
  const fullTitle = pageTitle(title);
  const url = absoluteUrl(path);
  const ogImage = image ? absoluteUrl(image) : SITE_OG_IMAGE;

  return [
    { title: fullTitle },
    { name: "description", content: description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: type },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: ogImage },
    { property: "og:locale", content: "pt_BR" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
  ];
};
