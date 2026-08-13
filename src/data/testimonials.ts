export type Testimonial = {
  id: string;
  name: string;
  role: string;
  text: string;
  avatar?: string | null;
};

export const testimonials: Testimonial[] = [
  {
    id: "t1",
    name: "Camila Souza",
    role: "Aluna há 2 anos",
    text:
      "Comecei correndo 3km e hoje completei minha primeira maratona. A estrutura de treino e o apoio da equipe são incomparáveis.",
  },
  {
    id: "t2",
    name: "Rodrigo Lima",
    role: "Maratonista amador",
    text:
      "Cortei 12 minutos no meu tempo de meia maratona em 6 meses. O acompanhamento individual faz toda a diferença.",
  },
  {
    id: "t3",
    name: "Marina Alves",
    role: "Iniciante",
    text:
      "Tinha medo de começar a correr sozinha. Aqui encontrei amigos e treinadores que me fazem querer voltar todo dia.",
  },
];

export const faqs = [
  {
    q: "Preciso já saber correr para entrar?",
    a: "Não! Recebemos pessoas em qualquer nível, do total iniciante ao maratonista experiente. Adaptamos o treino para você.",
  },
  {
    q: "Como funciona a aula experimental?",
    a: "É gratuita e sem compromisso. Você participa de um treino com a equipe e conhece a metodologia. Basta agendar pelo WhatsApp.",
  },
  {
    q: "Onde acontecem os treinos?",
    a: "Temos pontos fixos em diferentes regiões da cidade: parques, pistas e ruas. A grade completa fica disponível para alunos no app.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Trabalhamos sem fidelidade. Você fica conosco enquanto fizer sentido para você.",
  },
  {
    q: "Tem plano para quem viaja muito?",
    a: "Sim! Os planos incluem planilha personalizada que você pode executar em qualquer lugar do mundo.",
  },
];
