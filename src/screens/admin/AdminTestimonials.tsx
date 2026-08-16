import { CrudTable } from "@/components/admin/CrudTable";

const AdminTestimonials = () => (
  <CrudTable
    table="testimonials"
    queryKey="testimonials"
    title="Depoimentos"
    displayKey="name"
    orderBy={{ column: "sort_order" }}
    fields={[
      { key: "name", label: "Nome" },
      { key: "role", label: "Contexto (ex: Primeira meia maratona)" },
      { key: "text", label: "Depoimento", type: "textarea" },
      { key: "avatar", label: "Foto do aluno", type: "image", hint: "Recomendado 400 × 400 px (quadrada). Aparece em um círculo pequeno." },
      { key: "sort_order", label: "Ordem", type: "number" },
    ]}
  />
);
export default AdminTestimonials;
