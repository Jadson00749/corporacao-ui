import { STORE_MOCK_ACCOUNT_DEMO } from "@/data/storeMockCatalog";
import { StoreAcquiredOrderPanel } from "@/components/store-mock/StoreAcquiredProducts";
import type { StoreAcquiredItem } from "@/components/store-mock/storeAcquiredTypes";

/** Bloco visual em Minha Conta — mesmos componentes do pagamento mock. */
export function StoreMockAccountProducts() {
  const demo = STORE_MOCK_ACCOUNT_DEMO;
  const items = demo.items as StoreAcquiredItem[];

  return (
    <StoreAcquiredOrderPanel
      className="mt-3"
      variant="account"
      items={items}
      summary={{
        registration_amount: demo.registration,
        products_amount: demo.products,
        total_amount: demo.total,
      }}
    />
  );
}
