export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export const formatEventDay = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.toLocaleDateString("pt-BR", { day: "2-digit" });
  const mon = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
  return `${day} ${mon}`;
};

export const formatSignupWhen = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Hoje, ${time}`;
  if (d.toDateString() === yday.toDateString()) return `Ontem, ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${time}`;
};

export const statusLabel = (status?: string | null) => {
  const s = (status || "").toLowerCase();
  if (s === "confirmada") return "Confirmada";
  if (s === "cancelada") return "Cancelada";
  return "Pendente";
};
