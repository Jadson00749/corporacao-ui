import { CrudTable } from "@/components/admin/CrudTable";

const AdminGallery = () => (
  <CrudTable
    table="gallery"
    queryKey="gallery"
    title="Galeria"
    displayKey="title"
    orderBy={{ column: "sort_order" }}
    fields={[
      { key: "src", label: "Foto", type: "image", hint: "Recomendado 1200 × 900 px (horizontal 4:3)." },
      { key: "title", label: "Título" },
      { key: "category", label: "Categoria (Provas / Treinos / Comunidade)" },
      { key: "sort_order", label: "Ordem", type: "number" },
    ]}
  />
);
export default AdminGallery;
