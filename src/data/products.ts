// ============================================================
// PRODUTOS - Camisetas, Bonés, Acessórios
// ============================================================
import shirt from "@/assets/product-shirt.jpg";
import cap from "@/assets/product-cap.jpg";
import bottle from "@/assets/product-bottle.jpg";
import jacket from "@/assets/product-jacket.jpg";

export type Product = {
  id: string;
  name: string;
  image: string;
  images?: string[];
  price?: string;
  description: string;
  ctaMessage: string;
};

export const products: Product[] = [
  {
    id: "p1",
    name: "Camiseta Oficial PACE",
    image: shirt,
    price: "R$ 119",
    description: "Tecido dry-fit premium, leve e respirável. Perfeita para treinos e provas.",
    ctaMessage: "Olá! Quero comprar a Camiseta Oficial PACE.",
  },
  {
    id: "p2",
    name: "Boné Performance",
    image: cap,
    price: "R$ 89",
    description: "Boné esportivo com tecido respirável e proteção UV. Ajuste confortável.",
    ctaMessage: "Olá! Quero comprar o Boné Performance PACE.",
  },
  {
    id: "p3",
    name: "Squeeze Térmico 750ml",
    image: bottle,
    price: "R$ 149",
    description: "Mantém líquidos gelados por até 12h. Inox premium, leve e durável.",
    ctaMessage: "Olá! Quero comprar o Squeeze Térmico PACE.",
  },
  {
    id: "p4",
    name: "Jaqueta Corta-Vento",
    image: jacket,
    price: "R$ 289",
    description: "Proteção contra vento e chuva leve. Compactável, ideal para treinos cedo.",
    ctaMessage: "Olá! Quero comprar a Jaqueta Corta-Vento PACE.",
  },
];
