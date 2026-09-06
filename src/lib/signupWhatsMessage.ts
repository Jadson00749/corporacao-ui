/**
 * Mensagem enviada ao WhatsApp ao anexar o comprovante PIX de uma inscrição.
 * Um bloco por participante; com mais de um participante, acrescenta o total.
 * Linhas sem dado são omitidas — nada é preenchido com valor inventado.
 */

export type SignupBlock = {
  participant: string;
  modality: string;
  category: string;
  kits: string[];
  shirtSize: string;
  value: number | null;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const blockLines = (b: SignupBlock): string[] =>
  [
    b.participant.trim() && `Participante: ${b.participant.trim()}`,
    b.modality.trim() && `Modalidade: ${b.modality.trim()}`,
    b.category.trim() && `Categoria: ${b.category.trim()}`,
    b.kits.filter(Boolean).length && `Kit: ${b.kits.filter(Boolean).join(", ")}`,
    b.shirtSize.trim() && `Tamanho da camiseta: ${b.shirtSize.trim()}`,
    b.value != null && b.value > 0 && `Valor: ${brl(b.value)}`,
  ].filter((line): line is string => typeof line === "string" && line.length > 0);

export const buildSignupWhatsMessage = ({
  responsible,
  eventName,
  blocks,
}: {
  responsible: string;
  eventName: string;
  blocks: SignupBlock[];
}): string => {
  const who = responsible.trim() || "atleta";
  const event = eventName.trim() || "prova";
  const filled = blocks.filter((b) => blockLines(b).length > 0);
  const many = filled.length > 1;

  const out: string[] = [
    many
      ? `Olá! Sou ${who} e fiz ${filled.length} inscrições na ${event}.`
      : `Olá! Sou ${who} e fiz uma inscrição na ${event}.`,
  ];

  for (const block of filled) {
    out.push("", ...blockLines(block));
  }

  if (many) {
    const total = filled.reduce((sum, b) => sum + (b.value ?? 0), 0);
    if (total > 0) out.push("", `Total: ${brl(total)}`);
  }

  out.push("", "Gostaria de enviar o comprovante PIX.");
  return out.join("\n");
};
