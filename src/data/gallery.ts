// ============================================================
// GALERIA DE FOTOS
// Adicione novas imagens importando do diretório src/assets
// ============================================================
import g1 from "@/assets/gallery-1.jpg";
import g2 from "@/assets/gallery-2.jpg";
import g3 from "@/assets/gallery-3.jpg";
import g4 from "@/assets/gallery-4.jpg";
import g5 from "@/assets/gallery-5.jpg";
import g6 from "@/assets/gallery-6.jpg";

export type GalleryItem = {
  id: string;
  src: string;
  title: string;
  category: "Provas" | "Treinos" | "Comunidade";
};

export const gallery: GalleryItem[] = [
  { id: "g1", src: g1, title: "Linha de chegada", category: "Provas" },
  { id: "g2", src: g2, title: "Treino de pista", category: "Treinos" },
  { id: "g3", src: g3, title: "Vitória em equipe", category: "Comunidade" },
  { id: "g4", src: g4, title: "Antes do treino", category: "Treinos" },
  { id: "g5", src: g5, title: "Encontro do grupo", category: "Comunidade" },
  { id: "g6", src: g6, title: "Trail run", category: "Provas" },
];
