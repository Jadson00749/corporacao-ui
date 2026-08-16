import { CrudTable } from "@/components/admin/CrudTable";

const AdminHighlights = () => (
  <CrudTable
    table="home_highlights"
    queryKey="home_highlights"
    title="Destaques da Home"
    displayKey="title"
    orderBy={{ column: "sort_order", ascending: true }}
    inlineToggleKey="active"
    inlineToggleLabel="Ativo"
    fields={[
      { key: "eyebrow", label: "Etiqueta superior (ex: PRÓXIMA PROVA, NOVIDADE)" },
      { key: "title", label: "Título principal" },
      { key: "subtitle", label: "Subtítulo / descrição curta", type: "textarea" },
      { key: "image", label: "Imagem", type: "image", hint: "Banner do destaque. Recomendado 1920 × 1080 px (horizontal 16:9)." },
      {
        key: "image_position",
        label: "Enquadramento da foto no banner",
        type: "image-focus",
        imageKey: "image",
        fitKey: "image_fit",
      },
      { key: "button_label", label: "Texto do botão (ex: Quero participar)", hint: "Opcional. Se vazio, o banner inteiro continua clicável quando houver destino." },
      {
        key: "button_link",
        label: "Para onde o banner leva ao clicar",
        type: "link",
        hint: "Escolha uma página do site ou cole uma URL externa. Deixe 'Nenhum' para um banner apenas informativo.",
      },
      { key: "active", label: "Ativo (aparece na home)", type: "boolean" },
      { key: "sort_order", label: "Ordem", type: "number" },
    ]}
  />
);

export default AdminHighlights;
