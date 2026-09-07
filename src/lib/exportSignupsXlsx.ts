import ExcelJS from "exceljs";
import {
  effectivePrice,
  isSeniorApplicableDistance,
  isSeniorAtEvent,
  isKidsDistance,
  kidsCategoryForAge,
  resolveKidsBracket,
  ageAtEvent,
  KIDS_BRACKETS,
} from "@/lib/eventPricing";

export type ExportSignup = {
  id: string;
  category: string;
  status: string;
  created_at: string;
  kit_option: string;
  shirt_size: string | null;
  team_name: string;
  event_id: string;
  events: { id: string; name: string; date: string; city: string } | null;
  participant_full_name?: string | null;
  participant_cpf?: string | null;
  participant_birth_date?: string | null;
  participant_gender?: string | null;
  participant_phone?: string | null;
  profiles: {
    full_name: string;
    cpf: string;
    email: string;
    whatsapp: string;
    team_name: string;
    city: string;
    state: string;
    gender: string;
    birth_date?: string | null;
  } | null;
};

export type EventPricingRow = { id: string; name: string; distances?: any };

const SIZES = ["PP", "P", "M", "G", "GG", "XG"];

export const slugify = (s: string) =>
  (s || "inscritos")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const formatKitOption = (value: string) => {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch {
    /* texto simples */
  }
  return value;
};

const parts = (category: string) =>
  (category || "").split("·").map((p) => p.trim()).filter(Boolean);

export const modalityOf = (category: string) => parts(category)[0] || "";

export const bracketOf = (category: string) => {
  const m = (category || "").match(/(\d{1,3})\s*[-–a]\s*(\d{1,3})/);
  if (m) return `${m[1]}-${m[2]}`;
  const last = parts(category).slice(-1)[0] || "";
  return /anos/i.test(last) ? last.replace(/\s*anos\s*/i, "").trim() : "";
};

const filled = (v?: string | null) => !!(v && String(v).trim());

export type ParticipantSnapshotFields = {
  participant_full_name?: string | null;
  participant_birth_date?: string | null;
  participant_cpf?: string | null;
  participant_gender?: string | null;
  participant_phone?: string | null;
};

/**
 * Há qualquer dado gravado do atleta na inscrição.
 * Só a ausência total caracteriza inscrição histórica (pré-snapshot).
 */
export const hasParticipantSnapshot = (s: ParticipantSnapshotFields) =>
  filled(s.participant_full_name) ||
  filled(s.participant_birth_date) ||
  filled(s.participant_cpf) ||
  filled(s.participant_gender) ||
  filled(s.participant_phone);

/**
 * Nome do atleta/participante.
 * Em Kids nunca promove o responsável (profiles) a participante.
 * Em adultos históricos sem snapshot, o fallback visual para o titular permanece.
 */
export const athleteName = (s: ExportSignup) => {
  if (filled(s.participant_full_name)) return s.participant_full_name!.trim();
  if (isKidsDistance(s.category)) return "";
  return s.profiles?.full_name || "";
};

/**
 * CPF do atleta. Profiles só se a inscrição for realmente antiga (sem nenhum participant_*).
 */
export const athleteCpf = (s: ExportSignup) => {
  if (filled(s.participant_cpf)) return s.participant_cpf!.trim();
  if (!hasParticipantSnapshot(s)) return s.profiles?.cpf || "";
  return "";
};

/**
 * Nascimento do atleta — base de idade/60+/Kids.
 * Sem misturar profiles.birth_date quando já existe qualquer snapshot.
 */
export const athleteBirth = (s: ExportSignup): string | null => {
  if (filled(s.participant_birth_date)) return s.participant_birth_date!.trim();
  if (!hasParticipantSnapshot(s)) return s.profiles?.birth_date ?? null;
  return null;
};

/** Telefone do participante; contato do titular fica em profiles. */
export const athletePhone = (s: ExportSignup) => {
  if (filled(s.participant_phone)) return s.participant_phone!.trim();
  if (!hasParticipantSnapshot(s)) return s.profiles?.whatsapp || "";
  return "";
};

export const responsibleName = (s: ExportSignup) => s.profiles?.full_name || "";

export const genderLabel = (s: ExportSignup): string => {
  const fromParticipant = (s.participant_gender || "").trim().toLowerCase();
  if (fromParticipant.startsWith("f")) return "Feminino";
  if (fromParticipant.startsWith("m")) return "Masculino";

  // Histórico sem nenhum participant_*: só então o gênero do titular é seguro.
  if (!hasParticipantSnapshot(s)) {
    const fromProfile = (s.profiles?.gender || "").trim().toLowerCase();
    if (fromProfile.startsWith("f")) return "Feminino";
    if (fromProfile.startsWith("m")) return "Masculino";
  }

  const cat = (s.category || "").toLowerCase();
  if (/femin/.test(cat)) return "Feminino";
  if (/mascul/.test(cat)) return "Masculino";
  return "Não informado";
};

const toDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const signupValue = (s: ExportSignup, event?: EventPricingRow): number | null => {
  const dist = modalityOf(s.category);
  const list: any[] = Array.isArray(event?.distances) ? (event!.distances as any[]) : [];
  let d = list.find((x) => (x?.distance || "").trim() === dist);
  if (!d && isKidsDistance(s.category)) {
    d = list.find((x) => isKidsDistance(x?.distance));
  }
  if (!d) return null;
  const senior = isSeniorApplicableDistance(d.distance || dist) && isSeniorAtEvent(athleteBirth(s), s.events?.date);
  const v = effectivePrice(d, senior);
  return typeof v === "number" && v > 0 ? v : null;
};

export async function exportSignupsXlsx(
  rows: ExportSignup[],
  events: EventPricingRow[],
  eventName?: string,
) {
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const data = rows.filter((r) => (r.status || "").toLowerCase() !== "cancelada");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Corporação";
  wb.created = new Date();

  // ---- Aba 1: Inscritos ----
  const ws = wb.addWorksheet("Inscritos", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Nome", key: "nome", width: 30 },
    { header: "Responsável", key: "responsavel", width: 30 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "Data de nascimento", key: "nasc", width: 18 },
    { header: "Sexo", key: "sexo", width: 14 },
    { header: "Modalidade", key: "mod", width: 18 },
    { header: "Categoria", key: "cat", width: 28 },
    { header: "Tamanho da camiseta", key: "camiseta", width: 20 },
    { header: "Kit", key: "kit", width: 26 },
    { header: "Cidade", key: "cidade", width: 22 },
    { header: "Equipe", key: "equipe", width: 22 },
    { header: "WhatsApp", key: "whats", width: 18 },
    { header: "E-mail", key: "email", width: 30 },
    { header: "Valor", key: "valor", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Data da inscrição", key: "criado", width: 20 },
  ];

  for (const r of data) {
    const kids = isKidsDistance(r.category);
    const age = ageAtEvent(athleteBirth(r), r.events?.date);
    const kidsCat = kids
      ? resolveKidsBracket({ age, category: r.category })?.category || r.category
      : r.category || "";
    ws.addRow({
      nome: athleteName(r),
      responsavel: responsibleName(r),
      cpf: athleteCpf(r),
      nasc: toDate(athleteBirth(r)),
      sexo: kids ? "Misto" : genderLabel(r),
      mod: kids ? "Kids" : modalityOf(r.category),
      cat: kidsCat,
      camiseta: (r.shirt_size || "").toUpperCase(),
      kit: formatKitOption(r.kit_option || ""),
      cidade: `${r.profiles?.city || ""}${r.profiles?.state ? ` / ${r.profiles.state}` : ""}`.trim(),
      equipe: r.team_name || r.profiles?.team_name || "",
      // Contato do responsável pela compra (conta); telefone do participante só como reforço.
      whats: r.profiles?.whatsapp || athletePhone(r),
      email: r.profiles?.email || "",
      valor: signupValue(r, eventMap.get(r.event_id)),
      status: (r.status || "").toLowerCase() === "confirmada" ? "Aprovada" : "Em andamento",
      criado: toDate(r.created_at),
    });
  }

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
  header.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  header.height = 26;

  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columnCount } };
  ws.getColumn("nasc").numFmt = "dd/mm/yyyy";
  ws.getColumn("criado").numFmt = "dd/mm/yyyy hh:mm";
  ws.getColumn("valor").numFmt = 'R$ #,##0.00';
  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
  });

  // ---- Aba Kids / Largada (cronometragem) ----
  const kidsRows = data.filter((r) => isKidsDistance(r.category));
  if (kidsRows.length) {
    const wsKids = wb.addWorksheet("Kids - Largada", { views: [{ state: "frozen", ySplit: 1 }] });
    wsKids.columns = [
      { header: "Categoria/Bateria", key: "bateria", width: 36 },
      { header: "Participante", key: "participante", width: 30 },
      { header: "Responsável", key: "responsavel", width: 30 },
      { header: "Data de nascimento", key: "nasc", width: 18 },
      { header: "Idade no dia do evento", key: "idade", width: 20 },
      { header: "Cidade", key: "cidade", width: 22 },
      { header: "Equipe", key: "equipe", width: 22 },
    ];

    const sorted = [...kidsRows].sort((a, b) => {
      const ageA = ageAtEvent(athleteBirth(a), a.events?.date);
      const ageB = ageAtEvent(athleteBirth(b), b.events?.date);
      const brA = resolveKidsBracket({ age: ageA, category: a.category });
      const brB = resolveKidsBracket({ age: ageB, category: b.category });
      const ia = brA ? KIDS_BRACKETS.findIndex((x) => x.id === brA.id) : 99;
      const ib = brB ? KIDS_BRACKETS.findIndex((x) => x.id === brB.id) : 99;
      if (ia !== ib) return ia - ib;
      return athleteName(a).localeCompare(athleteName(b), "pt-BR");
    });

    for (const r of sorted) {
      const birth = athleteBirth(r);
      const age = ageAtEvent(birth, r.events?.date);
      const br = resolveKidsBracket({ age, category: r.category });
      const bateria =
        br?.category ||
        kidsCategoryForAge(age) ||
        r.category ||
        "Aguardando classificação";
      wsKids.addRow({
        bateria,
        participante: athleteName(r) || "(cadastro incompleto)",
        responsavel: responsibleName(r) || "",
        nasc: toDate(birth),
        idade: age ?? "",
        cidade: `${r.profiles?.city || ""}${r.profiles?.state ? ` / ${r.profiles.state}` : ""}`.trim(),
        equipe: r.team_name || r.profiles?.team_name || "",
      });
    }

    const hk = wsKids.getRow(1);
    hk.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hk.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
    hk.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    hk.height = 26;
    wsKids.autoFilter = { from: "A1", to: { row: 1, column: wsKids.columnCount } };
    wsKids.getColumn("nasc").numFmt = "dd/mm/yyyy";
    wsKids.eachRow((row, i) => {
      if (i === 1) return;
      row.alignment = { vertical: "top", wrapText: true };
    });
  }

  // ---- Aba 2: Resumo de camisetas ----
  const ws2 = wb.addWorksheet("Resumo de camisetas");
  ws2.columns = [
    { header: "Tamanho", key: "t", width: 16 },
    { header: "Quantidade", key: "q", width: 16 },
  ];
  const sizeCount = new Map<string, number>();
  for (const r of data) {
    const sz = (r.shirt_size || "").trim().toUpperCase();
    if (!sz) continue;
    sizeCount.set(sz, (sizeCount.get(sz) ?? 0) + 1);
  }
  const allSizes = [...SIZES, ...Array.from(sizeCount.keys()).filter((s) => !SIZES.includes(s))];
  allSizes.forEach((s) => ws2.addRow({ t: s, q: sizeCount.get(s) ?? 0 }));
  ws2.addRow({ t: "Total", q: Array.from(sizeCount.values()).reduce((a, b) => a + b, 0) }).font = {
    bold: true,
  };
  const h2 = ws2.getRow(1);
  h2.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
  ws2.views = [{ state: "frozen", ySplit: 1 }];

  // ---- Aba 3: Resumo por categoria ----
  const ws3 = wb.addWorksheet("Resumo por categoria");
  ws3.columns = [
    { header: "Modalidade", key: "mod", width: 20 },
    { header: "Gênero", key: "gen", width: 16 },
    { header: "Faixa etária", key: "faixa", width: 16 },
    { header: "Inscritos", key: "q", width: 12 },
  ];
  const catMap = new Map<string, { mod: string; gen: string; faixa: string; q: number }>();
  for (const r of data) {
    const mod = modalityOf(r.category) || "Não informado";
    const kids = isKidsDistance(r.category);
    const gen = kids ? "Misto" : genderLabel(r);
    const age = ageAtEvent(athleteBirth(r), r.events?.date);
    const kidsBr = kids ? resolveKidsBracket({ age, category: r.category }) : null;
    const faixa = kids
      ? kidsBr?.ageLabel || bracketOf(r.category) || "Não informada"
      : bracketOf(r.category) || "Não informada";
    const key = `${mod}|${gen}|${faixa}`;
    const cur = catMap.get(key) ?? { mod, gen, faixa, q: 0 };
    cur.q += 1;
    catMap.set(key, cur);
  }
  Array.from(catMap.values())
    .sort((a, b) => a.mod.localeCompare(b.mod) || a.gen.localeCompare(b.gen) || a.faixa.localeCompare(b.faixa))
    .forEach((v) => ws3.addRow(v));
  const h3 = ws3.getRow(1);
  h3.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
  ws3.views = [{ state: "frozen", ySplit: 1 }];
  ws3.autoFilter = { from: "A1", to: { row: 1, column: 4 } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inscritos-${slugify(eventName || "todas-as-provas")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
