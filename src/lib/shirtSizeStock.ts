/** Estoque opcional por tamanho de camiseta (events.shirt_size_stock). */

export type ShirtSizeStock = Record<string, number>;

export type ShirtSizeAvailability = {
  size: string;
  max_quantity: number | null;
  used: number;
  remaining: number | null;
  unlimited: boolean;
  available: boolean;
};

export const normalizeShirtSize = (s?: string | null) =>
  String(s ?? "")
    .trim()
    .toUpperCase();

/** Parse JSONB / objeto do evento. Chaves normalizadas; só limites > 0. */
export const parseShirtSizeStock = (raw: unknown): ShirtSizeStock => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ShirtSizeStock = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const size = normalizeShirtSize(k);
    if (!size) continue;
    const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
    if (!Number.isFinite(n) || n <= 0) continue;
    out[size] = Math.floor(n);
  }
  return out;
};

export const shirtSizeStockLimit = (stock: ShirtSizeStock, size: string): number | null => {
  const key = normalizeShirtSize(size);
  if (!key) return null;
  const lim = stock[key];
  if (lim == null || !Number.isFinite(lim) || lim <= 0) return null;
  return Math.floor(lim);
};

export const setShirtSizeStockLimit = (
  stock: ShirtSizeStock,
  size: string,
  value: number | null | undefined
): ShirtSizeStock => {
  const key = normalizeShirtSize(size);
  if (!key) return stock;
  const next = { ...stock };
  if (value == null || !Number.isFinite(value) || value <= 0) {
    delete next[key];
  } else {
    next[key] = Math.floor(value);
  }
  return next;
};

/** Coleta tamanhos únicos das kit_options (ordem estável). */
export const collectKitShirtSizes = (kitOptions: unknown): string[] => {
  if (!Array.isArray(kitOptions)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of kitOptions) {
    const sizes = Array.isArray((k as any)?.sizes) ? ((k as any).sizes as unknown[]) : [];
    for (const s of sizes) {
      const n = normalizeShirtSize(String(s ?? ""));
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
  }
  return out;
};

export const isShirtSizeSoldOut = (row?: ShirtSizeAvailability | null) =>
  !!row && !row.unlimited && !row.available;

/**
 * Mensagem amigável SOMENTE para o atleta na inscrição.
 * Casa apenas overselling real do trigger (ex.: "O tamanho G está esgotado.").
 * Não interpreta nome de coluna, schema cache ou RPC.
 */
export const shirtStockErrorMessage = (err: unknown): string | null => {
  const msg = String((err as any)?.message || err || "");
  if (/está esgotado/i.test(msg)) {
    return "Esse tamanho acabou de esgotar. Escolha outro tamanho disponível para continuar.";
  }
  return null;
};

/**
 * Mensagens administrativas ao salvar a prova (nunca usa texto do atleta).
 * - piso abaixo do usado → mensagem do banco
 * - falha de coluna/config de estoque → aviso de configuração
 * - demais → null (caller usa error.message)
 */
export const adminShirtStockSaveErrorMessage = (err: unknown): string | null => {
  const msg = String((err as any)?.message || err || "");
  if (
    /não pode ser menor/i.test(msg) ||
    /reservando o tamanho/i.test(msg) ||
    /Quantidade inválida para o tamanho/i.test(msg)
  ) {
    return msg;
  }
  if (
    /shirt_size_stock/i.test(msg) ||
    /schema cache/i.test(msg) ||
    /PGRST204/i.test(msg) ||
    (/column/i.test(msg) && /shirt.?size/i.test(msg))
  ) {
    console.warn("[admin shirt_size_stock save]", msg);
    return "Não foi possível salvar a configuração de estoque. Verifique a configuração do banco.";
  }
  return null;
};
