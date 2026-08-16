import { CrudTable } from "@/components/admin/CrudTable";

const AdminProducts = () => (
  <CrudTable
    table="products"
    queryKey="products"
    title="Produtos"
    displayKey="name"
    orderBy={{ column: "sort_order" }}
    inlineToggleKey="active"
    inlineToggleLabel="Ativo"
    fields={[
      { key: "name", label: "Nome do produto" },
      { key: "image", label: "Imagem", type: "image", hint: "Recomendado 1080 × 1080 px (quadrada 1:1)." },
      { key: "price", label: "Preço (ex: R$ 120)" },
      { key: "description", label: "Descrição", type: "textarea" },
      { key: "cta_message", label: "Mensagem do botão (WhatsApp)" },
      { key: "active", label: "Ativo (aparece no site)", type: "boolean" },
      { key: "sort_order", label: "Ordem", type: "number" },
    ]}
  />
);
export default AdminProducts;
