/**
 * Item adquirido da loja — shape preparado para dados reais futuros.
 * Agora alimentado só pelo mock.
 */
export type StoreAcquiredItem = {
  id: string;
  image?: string | null;
  /** Gradiente CSS quando não há image (mock). */
  imageTone?: string | null;
  name: string;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  fulfillment_type?: "kit_pickup" | string;
  fulfillment_note?: string;
};

export type StoreOrderSummary = {
  registration_amount: number;
  products_amount: number;
  total_amount: number;
  registration_label?: string;
};
