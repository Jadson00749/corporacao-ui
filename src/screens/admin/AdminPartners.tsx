import { CrudTable } from "@/components/admin/CrudTable";

const AdminPartners = () => (
  <CrudTable
    table="partners"
    queryKey="partners"
    title="Parceiros"
    displayKey="name"
    orderBy={{ column: "sort_order", ascending: true }}
    inlineToggleKey="active"
    inlineToggleLabel="Ativo"
    fields={[
      { key: "name", label: "Nome do parceiro" },
      { key: "logo", label: "Logo (imagem)", type: "image", hint: "Recomendado 400 × 200 px (PNG com fundo transparente ou branco)." },
      { key: "url", label: "Link / site (opcional)" },
      { key: "category", label: "Categoria (ex: Viagens, Suplementos, Alimentação)" },
      { key: "description", label: "Descrição curta (aparece nos destaques)", type: "textarea" },
      { key: "benefit_text", label: "Benefício (ex: 15% OFF em toda loja)" },
      { key: "coupon_code", label: "Código do cupom (opcional)" },
      { key: "featured", label: "Parceiro Destaque (collab/cupom ativo)", type: "boolean" },
      {
        key: "tier",
        label: "Nível do patrocinador — digite 'gold' para Patrocinador Ouro (destaque no topo da home) ou deixe 'standard' (aparece no carrossel ao final da home)",
      },
      { key: "active", label: "Ativo (aparece no site)", type: "boolean" },
      { key: "sort_order", label: "Ordem", type: "number" },
    ]}
  />
);

export default AdminPartners;
