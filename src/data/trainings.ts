// ============================================================
// PRÓXIMOS TREINOS
// Para adicionar novos treinos, copie um item e edite os dados.
// ============================================================

export type Training = {
  id: string;
  title: string;
  date: string;       // formato: "2025-05-10" (ISO)
  time: string;       // formato: "06:00"
  location: string;
  mapUrl?: string;
  description: string;
  level: "Iniciante" | "Intermediário" | "Avançado" | "Todos os níveis";
  capacity?: number | null; // null/undefined = sem limite de vagas
  image?: string;     // banner do treino (foto vertical, padrão 9:16)
};

export const trainings: Training[] = [
  {
    id: "t1",
    title: "Treino de Longão no Ibirapuera",
    date: "2025-05-04",
    time: "06:30",
    location: "Portão 7 - Parque Ibirapuera, SP",
    mapUrl: "https://maps.google.com/?q=Parque+Ibirapuera+Portão+7",
    description:
      "Treinão mensal da equipe: longão de domingo em ritmo controlado, com coaches acompanhando.",
    level: "Todos os níveis",
  },
  {
    id: "t2",
    title: "Tiros na Pista do CERET",
    date: "2025-05-07",
    time: "19:30",
    location: "CERET - Tatuapé, SP",
    mapUrl: "https://maps.google.com/?q=CERET+Tatuapé",
    description:
      "Treino de velocidade em pista com acompanhamento da equipe para evoluir ritmo, resistência e confiança.",
    level: "Intermediário",
  },
  {
    id: "t3",
    title: "Trote Regenerativo no Villa-Lobos",
    date: "2025-05-09",
    time: "07:00",
    location: "Parque Villa-Lobos, SP",
    mapUrl: "https://maps.google.com/?q=Parque+Villa+Lobos",
    description:
      "Rodagem leve para recuperar o corpo, respirar e fechar a semana correndo com a equipe.",
    level: "Todos os níveis",
  },
  {
    id: "t4",
    title: "Subida de Morro - Jaraguá",
    date: "2025-05-11",
    time: "06:00",
    location: "Pico do Jaraguá, SP",
    mapUrl: "https://maps.google.com/?q=Pico+do+Jaraguá",
    description:
      "Treino de força e resistência específica para subidas. Excelente para ganhar potência nas pernas.",
    level: "Avançado",
  },
];
