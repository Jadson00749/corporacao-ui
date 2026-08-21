import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

export type PublicSignup = {
  full_name: string;
  city: string;
  team_name: string;
  category: string;
  status: string;
  gender: string;
  age: number | null;
};

type GenderFilter = "all" | "F" | "M";

export const normalizeGender = (g: string): "F" | "M" | "O" => {
  const s = (g || "").trim().toLowerCase();
  if (s.startsWith("f")) return "F";
  if (s.startsWith("m")) return "M";
  return "O";
};

/** Usa o gênero do perfil; se vier vazio, tenta identificar pelo texto da categoria. */
export const signupGender = (s: { gender?: string; category?: string }): "F" | "M" | "O" => {
  const fromProfile = normalizeGender(s.gender || "");
  if (fromProfile !== "O") return fromProfile;
  const cat = (s.category || "").toLowerCase();
  if (/femin/.test(cat)) return "F";
  if (/mascul/.test(cat)) return "M";
  return "O";
};

// Extrai a distância (ex: "10K") da categoria "10K · Masculino"
const extractDistance = (category: string): string => {
  if (!category) return "Distância não informada";
  return category.split("·")[0].trim().toUpperCase() || "Distância não informada";
};

const DEFAULT_AGE_BRACKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "14 A 24 ANOS", min: 14, max: 24 },
  { label: "25 A 34 ANOS", min: 25, max: 34 },
  { label: "35 A 44 ANOS", min: 35, max: 44 },
  { label: "45 A 54 ANOS", min: 45, max: 54 },
  { label: "55 A 64 ANOS", min: 55, max: 64 },
  { label: "65+ ANOS", min: 65, max: 200 },
];

type Props = {
  signups: PublicSignup[];
  distances: string[];
  genders?: string[] | null;
  ageBrackets?: unknown;
  loading?: boolean;
};

const AthleteRows = ({ list }: { list: PublicSignup[] }) => (
  <>
    {/* Desktop: tabela */}
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
              <td className="px-3 py-2 capitalize font-medium">{(s.full_name || "").toLowerCase()}</td>
              <td className="px-3 py-2 capitalize text-muted-foreground">{(s.city || "-").toLowerCase()}</td>
              <td className="px-3 py-2 capitalize text-muted-foreground">{(s.team_name || "-").toLowerCase()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Mobile: cards compactos */}
    <ul className="sm:hidden space-y-2">
      {list.map((s, i) => (
        <li key={i} className="rounded-xl border border-border/70 bg-card/60 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-bold text-brand">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold capitalize">{(s.full_name || "").toLowerCase()}</p>
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

export const PublicSignupList = ({ signups, distances, genders, ageBrackets, loading }: Props) => {
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

  const { grid, orphans } = useMemo(() => {
    const g: Record<string, Record<string, Record<string, PublicSignup[]>>> = {};
    const ensure = (d: string, gen: string, b: string) => {
      g[d] = g[d] || {};
      g[d][gen] = g[d][gen] || {};
      g[d][gen][b] = g[d][gen][b] || [];
      return g[d][gen][b];
    };
    for (const d of distances) for (const gen of genderList) for (const b of bracketList) ensure(d, gen.label, b.label);

    const matchDistance = (cat: string) => {
      const raw = extractDistance(cat);
      return (
        distances.find((d) => d.toUpperCase() === raw) ||
        distances.find((d) => d.toUpperCase().includes(raw) || raw.includes(d.toUpperCase())) ||
        null
      );
    };
    const bracketOf = (s: PublicSignup) => {
      const m = (s.category || "").match(/(\d{1,3})\s*[-–a]\s*(\d{1,3})/);
      if (m) {
        const found = bracketList.find((b) => b.min === Number(m[1]) && b.max === Number(m[2]));
        if (found) return found.label;
      }
      if (s.age != null) {
        const found = bracketList.find((b) => s.age! >= b.min && s.age! <= b.max);
        if (found) return found.label;
      }
      return null;
    };

    const orph: PublicSignup[] = [];
    for (const s of signups) {
      const d = matchDistance(s.category);
      const gen = genderList.find((x) => x.code === signupGender(s))?.label;
      const b = bracketOf(s);
      if (!d || !gen || !b) {
        orph.push(s);
        continue;
      }
      ensure(d, gen, b).push(s);
    }
    return { grid: g, orphans: orph };
  }, [signups, distances, genderList, bracketList]);

  if (loading) return <div className="py-10 text-center text-muted-foreground">Carregando...</div>;

  const activeDist = distTab && distances.includes(distTab) ? distTab : distances[0] ?? null;

  const distTotal = (d: string) =>
    genderList.reduce(
      (acc, g) => acc + bracketList.reduce((a, b) => a + (grid[d]?.[g.label]?.[b.label]?.length ?? 0), 0),
      0
    );
  const genderTotal = (d: string, code: "F" | "M") =>
    genderList
      .filter((g) => g.code === code)
      .reduce((acc, g) => acc + bracketList.reduce((a, b) => a + (grid[d]?.[g.label]?.[b.label]?.length ?? 0), 0), 0);

  const visibleGenders = genderList.filter((g) => genderFilter === "all" || g.code === genderFilter);
  const visible = (s: PublicSignup) => genderFilter === "all" || signupGender(s) === genderFilter;
  const orphansVisible = orphans.filter(visible);

  return (
    <div className="space-y-5">
      {/* Resumo geral */}
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
          {/* Tabs de modalidade */}
          <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-2 px-1">
              {distances.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDistTab(d)}
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

          {activeDist && (
            <>
              {/* Filtro de gênero */}
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

              <p className="text-xs text-muted-foreground">Somente inscrições confirmadas aparecem nesta lista.</p>

              {/* Faixas etárias — sempre visíveis, mesmo vazias */}
              <div className="space-y-5">
                {visibleGenders.map((g) => (
                  <div key={g.label} className="space-y-3">
                    {visibleGenders.length > 1 && (
                      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                        {g.label}
                      </h3>
                    )}
                    {bracketList.map((b) => {
                      const list = grid[activeDist]?.[g.label]?.[b.label] ?? [];
                      return (
                        <section key={b.label} className="space-y-2">
                          <header className="flex items-center justify-between gap-3 border-b border-border/70 pb-1.5">
                            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-foreground/90">
                              {b.label}
                            </h4>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                                list.length
                                  ? "bg-brand/15 text-brand"
                                  : "bg-secondary/60 text-muted-foreground"
                              )}
                            >
                              {list.length} {list.length === 1 ? "inscrito" : "inscritos"}
                            </span>
                          </header>
                          {list.length > 0 && <AthleteRows list={list} />}
                        </section>
                      );
                    })}
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
            <h4 className="font-display text-xs font-bold uppercase tracking-wider">Outras categorias</h4>
            <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              {orphansVisible.length}
            </span>
          </header>
          <AthleteRows list={orphansVisible} />
        </div>
      )}
    </div>
  );
};

export default PublicSignupList;
