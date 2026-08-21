// ============================================================
// PROVAS E EVENTOS
// Atualize as provas e os links de inscrição livremente.
// ============================================================

export type EventStatus = "open" | "soon" | "closed";

export type EventDistance = {
  distance: string;
  price?: number;
  price_lote2?: number;
  lote2_starts_at?: string | null;
  price_lote3?: number;
  lote3_starts_at?: string | null;
  price_60_plus?: number;
};
export type EventAgeBracket = { min: number; max: number };
export type EventKitOption = { name: string; extra_price?: number };
export type EventCoupon = { code: string; description?: string };

export type RaceEvent = {
  id: string;
  name: string;
  date: string;
  city: string;
  distance: string;
  description: string;
  registrationUrl: string;
  status: EventStatus;
  image?: string;
  bannerImage?: string;
  bannerMobileImage?: string;
  bannerAspectRatio?: string;
  internalSignup?: boolean;
  regulationUrl?: string;
  kitInfo?: string;
  kitDelivery?: string;
  moreInfo?: string;
  eventTerms?: string;
  registrationDeadline?: string | null;
  distances?: EventDistance[];
  genders?: string[];
  ageBrackets?: EventAgeBracket[];
  kitOptions?: EventKitOption[];
  coupons?: EventCoupon[];
};

export const events: RaceEvent[] = [
  {
    id: "e1",
    name: "Maratona Internacional de São Paulo",
    date: "2025-06-15",
    city: "São Paulo, SP",
    distance: "5K • 21K • 42K",
    description:
      "A prova mais tradicional da capital paulista, com largada e chegada no Ibirapuera.",
    registrationUrl: "https://example.com/inscricoes/maratona-sp",
    status: "open",
  },
  {
    id: "e2",
    name: "Corrida da Avenida Paulista",
    date: "2025-07-20",
    city: "São Paulo, SP",
    distance: "5K • 10K",
    description:
      "Largada na Av. Paulista com percurso fechado pela cidade. Ideal para baterem novos PRs.",
    registrationUrl: "https://example.com/inscricoes/paulista",
    status: "open",
  },
  {
    id: "e3",
    name: "Meia Maratona do Rio",
    date: "2025-08-10",
    city: "Rio de Janeiro, RJ",
    distance: "5K • 10K • 21K",
    description:
      "Percurso à beira-mar entre Copacabana e Ipanema. Vamos viajar com a equipe completa!",
    registrationUrl: "https://example.com/inscricoes/meia-rio",
    status: "soon",
  },
  {
    id: "e4",
    name: "Trail Run Serra da Cantareira",
    date: "2025-04-12",
    city: "Mairiporã, SP",
    distance: "12K • 25K",
    description: "Trail técnico em meio à mata atlântica. Edição encerrada, fotos disponíveis na galeria.",
    registrationUrl: "https://example.com/inscricoes/trail-cantareira",
    status: "closed",
  },
];

export const eventStatusLabel: Record<EventStatus, string> = {
  open: "Inscrições abertas",
  soon: "Em breve",
  closed: "Encerrado",
};
