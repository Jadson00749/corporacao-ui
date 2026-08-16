import { CrudTable } from "@/components/admin/CrudTable";

const AdminPhotoEvents = () => (
  <CrudTable
    table="photo_events"
    queryKey="photo_events"
    title="Fotos dos eventos"
    displayKey="title"
    orderBy={{ column: "date", ascending: false }}
    inlineToggleKey="active"
    inlineToggleLabel="Ativo"
    fields={[
      { key: "title", label: "Nome do evento" },
      { key: "date", label: "Data", type: "date" },
      { key: "location", label: "Local / cidade" },
      { key: "cover_image", label: "Imagem de capa", type: "image", hint: "Recomendado 1920 × 1080 px (horizontal 16:9)." },
      { key: "description", label: "Descrição curta", type: "textarea" },
      { key: "photo_link", label: "Link oficial das fotos (URL externa)" },
      { key: "status", label: "Status (Fotos disponíveis / Em breve / Encerrado)" },
      { key: "active", label: "Ativo (aparece no site)", type: "boolean" },
      { key: "sort_order", label: "Ordem", type: "number" },
    ]}
  />
);

export default AdminPhotoEvents;
