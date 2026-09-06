/**
 * Modelo compartilhado do catálogo de locação (tabela rental_items),
 * usado pela seleção do organizador e pela gestão do super admin.
 */

export type RentalItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit_type: string | null;
  unit_label: string | null;
  price: number | string | null;
  image_url: string | null;
  options: unknown;
  sort_order: number | null;
  /** Presentes apenas nas consultas da gestão administrativa. */
  requires_technician?: boolean | null;
  stock_quantity?: number | string | null;
  active?: boolean | null;
};

/** Como o item é cobrado/configurado — derivado de unit_type. */
export type ItemKind = "quantity" | "meters" | "days" | "single" | "configuration";

export type RentalOption = { label: string; price?: number; extra: number };

export const priceOf = (item: RentalItem) => Number(item.price ?? 0) || 0;

export const kindOf = (unitType: string | null | undefined): ItemKind => {
  switch ((unitType || "").trim().toLowerCase()) {
    case "meter":
    case "metro":
    case "metros":
      return "meters";
    case "day":
    case "diaria":
    case "diária":
      return "days";
    case "event":
    case "evento":
      return "single";
    case "configuration":
    case "configuracao":
    case "configuração":
      return "configuration";
    default:
      return "quantity";
  }
};

export const KIND_LABEL: Record<ItemKind, string> = {
  quantity: "Por unidade",
  meters: "Por metro",
  days: "Por diária",
  single: "Por evento",
  configuration: "Configurável",
};

export const KIND_UNIT: Record<ItemKind, string> = {
  quantity: "un.",
  meters: "m",
  days: "diária",
  single: "evento",
  configuration: "configuração",
};

export const KIND_QTY_LABEL: Record<ItemKind, string> = {
  quantity: "Quantidade",
  meters: "Metros",
  days: "Diárias",
  single: "",
  configuration: "",
};

/** Valores gravados em unit_type pela gestão administrativa. */
export const UNIT_TYPE_OPTIONS = [
  { value: "unit", label: "Unidade — quantidade", hint: "Ex.: 20 cones, 4 tendas" },
  { value: "meter", label: "Metro — quantidade em metros", hint: "Ex.: 30 m de grade" },
  { value: "day", label: "Diária — número de diárias", hint: "Ex.: 3 diárias de gerador" },
  { value: "event", label: "Evento — seleção simples", hint: "Cobrado uma vez por evento" },
  { value: "configuration", label: "Configuração — escolha de opções", hint: "Usa as opções abaixo" },
] as const;

/** Rótulo humano da unidade de cobrança; unit_label tem prioridade sobre o padrão do tipo. */
export const unitOf = (item: RentalItem, kind: ItemKind) =>
  item.unit_label?.trim() || KIND_UNIT[kind];

/**
 * options é jsonb, então aceita tanto lista de strings quanto de objetos.
 * Uma opção pode trazer preço próprio (price) ou acréscimo sobre o preço base (extra_price).
 */
export const parseOptions = (raw: unknown): RentalOption[] => {
  const wrapper = raw as { options?: unknown; choices?: unknown } | null;
  const source: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray(wrapper?.options)
      ? wrapper.options
      : Array.isArray(wrapper?.choices)
        ? wrapper.choices
        : [];

  return source.reduce<RentalOption[]>((acc, entry) => {
    if (typeof entry === "string" || typeof entry === "number") {
      const label = String(entry).trim();
      if (label) acc.push({ label, extra: 0 });
      return acc;
    }
    if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const rawLabel = obj.label ?? obj.name ?? obj.title ?? obj.value;
      const label = rawLabel == null ? "" : String(rawLabel).trim();
      if (!label) return acc;
      acc.push({
        label,
        price: typeof obj.price === "number" ? obj.price : undefined,
        extra: Number(obj.extra_price ?? obj.extra ?? 0) || 0,
      });
    }
    return acc;
  }, []);
};

export const unitPriceOf = (item: RentalItem, option?: RentalOption) => {
  const base = priceOf(item);
  if (!option) return base;
  if (typeof option.price === "number") return option.price;
  return base + option.extra;
};

/** Colunas usadas pelo catálogo de seleção do organizador. */
export const CATALOG_COLUMNS =
  "id,name,description,category,unit_type,unit_label,price,image_url,options,sort_order";

/** Colunas usadas pela gestão administrativa do catálogo. */
export const ADMIN_COLUMNS = `${CATALOG_COLUMNS},requires_technician,stock_quantity,active`;
