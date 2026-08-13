import { CrudTable } from "@/components/admin/CrudTable";

const AdminFaqs = () => (
  <CrudTable
    table="faqs"
    queryKey="faqs"
    title="FAQs"
    displayKey="question"
    orderBy={{ column: "sort_order" }}
    fields={[
      { key: "question", label: "Pergunta" },
      { key: "answer", label: "Resposta", type: "textarea" },
      { key: "sort_order", label: "Ordem", type: "number" },
    ]}
  />
);
export default AdminFaqs;
