/**
 * Helpers de kit_options (events.kit_options JSON).
 * Presets agilizam o cadastro; a estrutura no banco continua genérica.
 */

import {
  activeLote,
  hasLote2,
  hasLote3,
  type DistancePricing,
} from "@/lib/eventPricing";

export type KitAvailability = "all_lots" | "last_lot";

export type EventKitOption = {
  name: string;
  description?: string;
  extra_price?: number;
  has_shirt?: boolean;
  sizes?: string[];
  size_chart_url?: string;
  size_chart_info?: string;
  availability?: KitAvailability;
  /** Legado local (se existir em JSON antigo) → tratado como last_lot. */
  only_last_lot?: boolean;
};

export type KitPresetId = "completo" | "economico" | "personalizado";

export const KIT_DEFAULT_SIZES = ["PP", "P", "M", "G", "GG", "XG"];

export const kitHasShirt = (k?: EventKitOption | null) => {
  if (!k) return false;
  const sizes = Array.isArray(k.sizes) ? k.sizes : [];
  return sizes.length > 0 || k.has_shirt === true;
};

/** Lê availability com default all_lots e compat only_last_lot. */
export const getKitAvailability = (k?: EventKitOption | null): KitAvailability => {
  if (!k) return "all_lots";
  if (k.availability === "last_lot" || k.availability === "all_lots") return k.availability;
  if (k.only_last_lot === true) return "last_lot";
  return "all_lots";
};

/** Número do último lote configurado na modalidade (1 se só um lote). */
export const lastLoteNumber = (d?: DistancePricing | null): 1 | 2 | 3 => {
  if (!d) return 1;
  if (hasLote3(d)) return 3;
  if (hasLote2(d)) return 2;
  return 1;
};

export const isActiveLoteLast = (d?: DistancePricing | null, today?: string) => {
  if (!d) return true;
  return activeLote(d, today) === lastLoteNumber(d);
};

/** Kit elegível para a modalidade no lote vigente. */
export const isKitAvailableForDistance = (
  kit: EventKitOption,
  distance?: DistancePricing | null,
  today?: string
) => {
  if (getKitAvailability(kit) === "all_lots") return true;
  return isActiveLoteLast(distance, today);
};

export const discountAmountFromExtra = (extra?: number | null) => {
  const n = Number(extra);
  if (!Number.isFinite(n) || n >= 0) return 0;
  return Math.abs(n);
};

export const extraPriceFromDiscount = (discount: number) => {
  const n = Math.abs(Number(discount) || 0);
  return n > 0 ? -n : 0;
};

export const formatKitExtraPriceLabel = (extra?: number | null): string | null => {
  const n = Number(extra);
  if (!Number.isFinite(n) || n === 0) return null;
  const abs = Math.abs(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return n > 0 ? `+ ${abs}` : `− ${abs}`;
};

/**
 * Converte links de compartilhamento (ex.: Google Drive /view) em URL usável
 * em <img>. Links de página HTML não carregam como imagem.
 */
export const resolveSizeChartImageUrl = (raw?: string | null): string => {
  const url = (raw || "").trim();
  if (!url) return "";

  const fileId =
    url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i)?.[1] ||
    url.match(/drive\.google\.com\/(?:open|uc)\?[^#]*[?&]id=([^&]+)/i)?.[1] ||
    url.match(/docs\.google\.com\/uc\?[^#]*[?&]id=([^&]+)/i)?.[1] ||
    null;

  if (fileId) {
    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
  }

  return url;
};

/** URL original para "abrir em nova aba" (mantém o link que o admin colou). */
export const sizeChartOpenUrl = (raw?: string | null): string => {
  const url = (raw || "").trim();
  if (!url) return "";
  return resolveSizeChartImageUrl(url) || url;
};

/** UI: kits sem camiseta usam campo "desconto"; com camiseta usam "ajuste". */
export const kitUsesDiscountField = (k: EventKitOption) => !kitHasShirt(k);

export const createKitFromPreset = (preset: KitPresetId): EventKitOption => {
  if (preset === "completo") {
    return {
      name: "Kit Completo",
      description: "Camiseta, número de peito e medalha",
      has_shirt: true,
      sizes: [...KIT_DEFAULT_SIZES],
      extra_price: 0,
      availability: "all_lots",
    };
  }
  if (preset === "economico") {
    return {
      name: "Kit Econômico",
      description: "Número de peito e medalha, sem camiseta",
      has_shirt: false,
      sizes: [],
      extra_price: -20,
      availability: "last_lot",
    };
  }
  return {
    name: "",
    description: "",
    has_shirt: false,
    sizes: [],
    extra_price: 0,
    availability: "all_lots",
  };
};
