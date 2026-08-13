// ============================================================
// FOTOS DOS EVENTOS — fallback estático (referência).
// Os links oficiais são gerenciados pelo admin no banco de dados.
// ============================================================

export type PhotoEventStatus = "Fotos disponíveis" | "Em breve" | "Encerrado";

export type PhotoEvent = {
  id: string;
  title: string;
  date: string | null; // ISO date or null
  location: string;
  coverImage?: string;
  description: string;
  photoLink: string;
  status: PhotoEventStatus;
};

export const photoEventStatuses: PhotoEventStatus[] = [
  "Fotos disponíveis",
  "Em breve",
  "Encerrado",
];

export const photoEvents: PhotoEvent[] = [
  {
    id: "1",
    title: "Treinão Corporação AE",
    date: "2026-04-20",
    location: "Araraquara/SP",
    coverImage: "",
    description: "Confira os registros oficiais do nosso treinão.",
    photoLink: "https://link-da-plataforma-de-fotos.com/evento",
    status: "Fotos disponíveis",
  },
  {
    id: "2",
    title: "Corrida Regional",
    date: "2026-05-10",
    location: "Ribeirão Preto/SP",
    coverImage: "",
    description: "As fotos estarão disponíveis em breve.",
    photoLink: "",
    status: "Em breve",
  },
];
