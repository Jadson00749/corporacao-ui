import { useEffect } from "react";
import { SITE_NAME, SITE_DESCRIPTION, SITE_OG_IMAGE, absoluteUrl } from "@/lib/seo";

type Props = {
  title: string;
  description?: string;
  /** Imagem de compartilhamento — sempre um asset oficial da Corporação ou da própria prova. */
  image?: string;
};

const setMeta = (attr: "name" | "property", key: string, content: string) => {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

export const SEO = ({ title, description, image }: Props) => {
  useEffect(() => {
    const fullTitle = title?.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const desc = description?.trim() || SITE_DESCRIPTION;
    const url = window.location.href;
    const ogImage = image ? absoluteUrl(image) : SITE_OG_IMAGE;

    document.title = fullTitle;
    setMeta("name", "description", desc);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", ogImage);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", ogImage);

    // canonical
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", url);
  }, [title, description, image]);
  return null;
};
