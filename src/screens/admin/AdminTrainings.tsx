import { CrudTable } from "@/components/admin/CrudTable";

const AdminTrainings = () => (
  <CrudTable
    table="trainings"
    queryKey="trainings"
    title="Treinos"
    displayKey="title"
    orderBy={{ column: "date" }}
    inlineToggleKey="active"
    inlineToggleLabel="Ativo"
    fields={[
      { key: "title", label: "Título" },
      { key: "date", label: "Data", type: "date" },
      { key: "time", label: "Hora (ex: 06:30)" },
      { key: "location", label: "Local" },
      { key: "map_url", label: "Link do mapa (Google Maps)" },
      { key: "description", label: "Descrição", type: "textarea" },
      { key: "image", label: "Banner do treino (foto vertical, padrão 9:16, ex: 1080 × 1920)", type: "image" },
      { key: "level", label: "Nível (Iniciante / Intermediário / Avançado / Todos os níveis)" },
      { key: "capacity", label: "Limite de vagas (deixe vazio = ilimitado)", type: "number" },
      { key: "active", label: "Ativo (aparece no site)", type: "boolean" },
      { key: "sort_order", label: "Ordem", type: "number" },
    ]}
  />
);
export default AdminTrainings;
