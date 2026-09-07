import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import {
  KIDS_BRACKETS,
  isKidsDistance,
  isWalkDistance,
  resolveKidsBracket,
  sportAgeAtEvent,
  ageAtEvent,
  type KidsBracket,
} from "@/lib/eventPricing";

export type PublicSignup = {
  /** Nome exibido (participante; em adulto histórico pode vir do titular via RPC). */
  full_name: string;
  /** Snapshot da criança/atleta — nunca o responsável. */
  participant_full_name?: string | null;
  /** Titular da conta que fez a inscrição. */
  responsible_name?: string | null;
  city: string;
  team_name: string;
  category: string;
  status: string;
  participant_birth_date?: string | null;
  participant_gender?: string | null;
  gender?: string | null;
  age?: number | null;
};

type GenderFilter = "all" | "F" | "M";

export const normalizeGender = (g: string): "F" | "M" | "O" => {
  const s = (g || "").trim().toLowerCase();
  if (s.startsWith("f")) return "F";
  if (s.startsWith("m")) return "M";
  return "O";
};

export const signupGender = (s: { gender?: string | null; participant_gender?: string | null; category?: string }): "F" | "M" | "O" => {
  const cat = (s.category || "").toLowerCase();
  if (/femin/.test(cat)) return "F";
  if (/mascul/.test(cat)) return "M";
  return normalizeGender(s.participant_gender || s.gender || "");
};

const extractDistance = (category: string): string => {
  if (!category) return "Distância não informada";
  return category.split("·")[0].trim().toUpperCase() || "Distância não informada";
};

type AgeBracket = { label: string; min: number; max: number };

const DEFAULT_AGE_BRACKETS: AgeBracket[] = [
  { label: "14 A 24 ANOS", min: 14, max: 24 },
  { label: "25 A 34 ANOS", min: 25, max: 34 },
  { label: "35 A 44 ANOS", min: 35, max: 44 },
  { label: "45 A 54 ANOS", min: 45, max: 54 },
  { label: "55 A 64 ANOS", min: 55, max: 64 },
  { label: "65+ ANOS", min: 65, max: 200 },
];

type Mode = "single" | "kids" | "brackets";

const modeOf = (distance: string): Mode =>
  isWalkDistance(distance) ? "single" : isKidsDistance(distance) ? "kids" : "brackets";

const bracketFromCategory = (category: string) =>
  (category || "").match(/(\d{1,3})\s*[-–a]\s*(\d{1,3})/);

type Bucket = { label: string; subtitle?: string; list: PublicSignup[] };
type Group = { gender: string | null; buckets: Bucket[] };
type DistGroups = { mode: Mode; groups: Group[] };

type Props = {
  signups: PublicSignup[];
  distances: string[];
  genders?: string[] | null;
  ageBrackets?: unknown;
  eventDate?: string | null;
  loading?: boolean;
};

const participantOf = (s: PublicSignup, kids = false) =>
  kids
    ? (s.participant_full_name || "").trim()
    : (s.participant_full_name || s.full_name || "").trim();

const responsibleOf = (s: PublicSignup) => (s.responsible_name || "").trim();

const AdultRows = ({ list }: { list: PublicSignup[] }) => (
  <>
    <div className="hidden sm:block overflow-hidden rounded-xl border border-border/70">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Nome</th>
            <th className="px-3 py-2 text-left font-semibold">Cidade</th>
            <th className="px-3 py-2 text-left font-semibold">Equipe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {list.map((s, i) => (
            <tr key={i} className="hover:bg-brand/5 transition-colors">
              <td className="px-3 py-2 capitalize font-medium">{participantOf(s).toLowerCase()}</td>
              <td className="px-3 py-2 capitalize text-muted-foreground">{(s.city || "-").toLowerCase()}</td>
              <td className="px-3 py-2 capitalize text-muted-foreground">{(s.team_name || "-").toLowerCase()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ul className="sm:hidden space-y-2">
      {list.map((s, i) => (
        <li key={i} className="rounded-xl border border-border/70 bg-card/60 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-bold text-brand">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold capitalize">{participantOf(s).toLowerCase()}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">
                {(s.city || "-").toLowerCase()}
                {s.team_name ? ` · ${s.team_name.toLowerCase()}` : ""}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  </>
);

/** Kids: Participante | Responsável | Cidade | Equipe (mista). */
const KidsRows = ({ list }: { list: PublicSignup[] }) => (
  <>
    <div className="hidden md:block overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-secondary/60 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Participante</th>
            <th className="px-3 py-2 text-left font-semibold">Responsável</th>
            <th className="px-3 py-2 text-left font-semibold">Cidade</th>
            <th className="px-3 py-2 text-left font-semibold">Equipe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {list.map((s, i) => (
            <tr key={i} className="hover:bg-brand/5 transition-colors">
              <td className="px-3 py-2 font-medium capitalize">{participantOf(s, true).toLowerCase() || "—"}</td>
              <td className="px-3 py-2 capitalize text-muted-foreground">
                {responsibleOf(s).toLowerCase() || "—"}
              </td>
              <td className="px-3 py-2 capitalize text-muted-foreground">{(s.city || "—").toLowerCase()}</td>
              <td className="px-3 py-2 capitalize text-muted-foreground">{(s.team_name || "—").toLowerCase()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ul className="md:hidden space-y-2">
      {list.map((s, i) => (
        <li key={i} className="rounded-xl border border-border/70 bg-card/60 px-3 py-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-bold text-brand">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold capitalize leading-snug">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block">
                  Participante
                </span>
                {participantOf(s, true).toLowerCase() || "—"}
              </p>
              <p className="text-sm capitalize leading-snug">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block">
                  Responsável
                </span>
                <span className="text-muted-foreground">{responsibleOf(s).toLowerCase() || "—"}</span>
              </p>
              <p className="text-xs capitalize text-muted-foreground pt-0.5">
                {(s.city || "—").toLowerCase()}
                {s.team_name ? ` · ${s.team_name.toLowerCase()}` : ""}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  </>
);

export const PublicSignupList = ({ signups, distances, genders, ageBrackets, eventDate, loading }: Props) => {
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [distTab, setDistTab] = useState<string | null>(null);

  const genderList = useMemo(
    () =>
      ((Array.isArray(genders) && genders.length ? genders : ["Masculino", "Feminino"]) as string[])
        .filter((g) => g && g.trim())
        .map((g) => ({ label: g, code: normalizeGender(g) })),
    [genders]
  );

  const bracketList = useMemo(() => {
    const cfg = (Array.isArray(ageBrackets) ? (ageBrackets as any[]) : []).filter(
      (b) => b && Number.isFinite(Number(b.min)) && Number.isFinite(Number(b.max))
    );
    return cfg.length
      ? cfg.map((b: any) => ({ label: `${b.min}–${b.max} anos`, min: Number(b.min), max: Number(b.max) }))
      : DEFAULT_AGE_BRACKETS.map((b) => ({ ...b }));
  }, [ageBrackets]);

  const { byDistance, orphans } = useMemo(() => {
    const result: Record<string, DistGroups> = {};
    for (const d of distances) {
      const mode = modeOf(d);
      if (mode === "kids") {
        result[d] = {
          mode,
          groups: [
            {
              gender: null,
              buckets: KIDS_BRACKETS.map((b) => ({
                label: b.title,
                subtitle: b.subtitle,
                list: [] as PublicSignup[],
              })),
            },
          ],
        };
      } else if (mode === "single") {
        result[d] = { mode, groups: [{ gender: null, buckets: [{ label: d, list: [] }] }] };
      } else {
        result[d] = {
          mode,
          groups: genderList.map((g) => ({
            gender: g.label,
            buckets: bracketList.map((b) => ({ label: b.label, list: [] as PublicSignup[] })),
          })),
        };
      }
    }

    const matchDistance = (cat: string, s: PublicSignup) => {
      if (isKidsDistance(cat) || isKidsDistance(s.category)) {
        return distances.find((d) => isKidsDistance(d)) || null;
      }
      const raw = extractDistance(cat);
      return (
        distances.find((d) => d.toUpperCase() === raw) ||
        distances.find((d) => d.toUpperCase().includes(raw) || raw.includes(d.toUpperCase())) ||
        null
      );
    };

    const ageOf = (s: PublicSignup, mode: Mode) => {
      const fromBirth = sportAgeAtEvent(s.participant_birth_date, eventDate);
      if (fromBirth != null) return fromBirth;
      if (mode === "kids") return null;
      const m = bracketFromCategory(s.category);
      if (m) return Number(m[1]);
      return s.age ?? null;
    };

    const kidsBucketIndex = (s: PublicSignup) => {
      const age = ageAtEvent(s.participant_birth_date, eventDate);
      const bracket: KidsBracket | null = resolveKidsBracket({ age, category: s.category });
      if (!bracket) return -1;
      return KIDS_BRACKETS.findIndex((b) => b.id === bracket.id);
    };

    const adultBucketIndex = (s: PublicSignup, mode: Mode, brackets: AgeBracket[]) => {
      if (mode === "brackets") {
        const m = bracketFromCategory(s.category);
        if (m) {
          const exact = brackets.findIndex((b) => b.min === Number(m[1]) && b.max === Number(m[2]));
          if (exact >= 0) return exact;
        }
      }
      const age = ageOf(s, mode);
      return age == null ? -1 : brackets.findIndex((b) => age >= b.min && age <= b.max);
    };

    const orph: PublicSignup[] = [];
    for (const s of signups) {
      const d = matchDistance(s.category, s);
      const entry = d ? result[d] : null;
      if (!entry) {
        orph.push(s);
        continue;
      }

      if (entry.mode === "kids") {
        // Kids: nunca promover o responsável a participante.
        const child = (s.participant_full_name || "").trim();
        if (!child || !s.participant_birth_date) {
          orph.push(s);
          continue;
        }
        const idx = kidsBucketIndex(s);
        if (idx < 0) {
          orph.push(s);
          continue;
        }
        entry.groups[0].buckets[idx].list.push(s);
        continue;
      }

      if (entry.mode === "single") {
        entry.groups[0].buckets[0].list.push(s);
        continue;
      }

      const genderLabel = genderList.find((x) => x.code === signupGender(s))?.label;
      const group = entry.groups.find((g) => g.gender === genderLabel);
      const idx = group ? adultBucketIndex(s, entry.mode, bracketList) : -1;
      if (!group || idx < 0) {
        orph.push(s);
        continue;
      }
      group.buckets[idx].list.push(s);
    }
    return { byDistance: result, orphans: orph };
  }, [signups, distances, genderList, bracketList, eventDate]);

  if (loading) return <div className="py-10 text-center text-muted-foreground">Carregando...</div>;

  const activeDist = distTab && distances.includes(distTab) ? distTab : distances[0] ?? null;
  const countGroups = (groups: Group[]) =>
    groups.reduce((acc, g) => acc + g.buckets.reduce((a, b) => a + b.list.length, 0), 0);
  const distTotal = (d: string) => countGroups(byDistance[d]?.groups ?? []);
  const codeOfLabel = (label: string | null) => genderList.find((x) => x.label === label)?.code;
  const genderTotal = (d: string, code: "F" | "M") =>
    countGroups((byDistance[d]?.groups ?? []).filter((g) => codeOfLabel(g.gender) === code));

  const activeEntry = activeDist ? byDistance[activeDist] : null;
  const singleMode = activeEntry?.mode === "single";
  const kidsMode = activeEntry?.mode === "kids";
  const visibleGroups = (activeEntry?.groups ?? []).filter(
    (g) => singleMode || kidsMode || genderFilter === "all" || codeOfLabel(g.gender) === genderFilter
  );

  const visible = (s: PublicSignup) =>
    kidsMode || genderFilter === "all" || signupGender(s) === genderFilter;
  const orphansVisible = orphans.filter(visible);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2.5">
        <Users className="h-4 w-4 shrink-0 text-brand" />
        <p className="text-sm">
          <span className="font-bold text-brand">{signups.length}</span>{" "}
          <span className="text-muted-foreground">
            {signups.length === 1 ? "atleta confirmado na prova" : "atletas confirmados na prova"}
          </span>
        </p>
      </div>

      {distances.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma modalidade configurada para esta prova.</p>
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-2 px-1">
              {distances.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDistTab(d);
                    setGenderFilter("all");
                  }}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all",
                    activeDist === d
                      ? "border-brand bg-brand text-brand-foreground shadow-brand"
                      : "border-border bg-secondary/40 text-muted-foreground hover:border-brand/50 hover:text-foreground"
                  )}
                >
                  {d} <span className="opacity-70">({distTotal(d)})</span>
                </button>
              ))}
            </div>
          </div>

          {activeDist && activeEntry && (
            <>
              {!singleMode && !kidsMode && (
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["all", "Todos", distTotal(activeDist)],
                      ["F", "Feminino", genderTotal(activeDist, "F")],
                      ["M", "Masculino", genderTotal(activeDist, "M")],
                    ] as const
                  ).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGenderFilter(value as GenderFilter)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all",
                        genderFilter === value
                          ? "border-brand bg-brand/15 text-brand"
                          : "border-border text-muted-foreground hover:border-brand/50 hover:text-foreground"
                      )}
                    >
                      {label} <span className="opacity-70">({count})</span>
                    </button>
                  ))}
                </div>
              )}

              {kidsMode && (
                <p className="text-xs text-muted-foreground">
                  Categoria mista — meninos e meninas na mesma bateria. Colunas: Participante e Responsável.
                </p>
              )}

              <p className="text-xs text-muted-foreground">Somente inscrições confirmadas aparecem nesta lista.</p>

              <div className="space-y-5">
                {visibleGroups.map((g) => (
                  <div key={g.gender ?? "todos"} className="space-y-3">
                    {g.gender && visibleGroups.length > 1 && (
                      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                        {g.gender}
                      </h3>
                    )}
                    {g.buckets.map((b) => (
                      <section key={b.label} className="space-y-2">
                        <header className="flex items-end justify-between gap-3 border-b border-border/70 pb-1.5">
                          <div className="min-w-0">
                            <h4 className="font-display text-sm font-bold tracking-tight text-foreground">
                              {b.label}
                            </h4>
                            {b.subtitle && (
                              <p className="text-xs text-muted-foreground mt-0.5">{b.subtitle}</p>
                            )}
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                              b.list.length ? "bg-brand/15 text-brand" : "bg-secondary/60 text-muted-foreground"
                            )}
                          >
                            {b.list.length} {b.list.length === 1 ? "inscrito" : "inscritos"}
                          </span>
                        </header>
                        {b.list.length > 0 && (kidsMode ? <KidsRows list={b.list} /> : <AdultRows list={b.list} />)}
                      </section>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {orphansVisible.length > 0 && (
        <div className="space-y-2">
          <header className="flex items-center justify-between gap-3 border-b border-border pb-1.5">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider">
              Aguardando classificação
            </h4>
            <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              {orphansVisible.length}
            </span>
          </header>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Faltam nome e/ou data de nascimento do participante (criança). O responsável não é listado
            como atleta.
          </p>
          {kidsMode || orphansVisible.some((s) => isKidsDistance(s.category)) ? (
            <KidsRows list={orphansVisible} />
          ) : (
            <AdultRows list={orphansVisible} />
          )}
        </div>
      )}
    </div>
  );
};

export default PublicSignupList;
