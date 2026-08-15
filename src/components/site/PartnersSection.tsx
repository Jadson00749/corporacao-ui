import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Partner = {
  id: string;
  name: string;
  logo: string;
  url: string | null;
  description: string;
  coupon_code: string;
  benefit_text: string;
  featured: boolean;
  category: string;
};

const usePartners = () =>
  useQuery({
    queryKey: ["partners", "standard"],
    queryFn: async (): Promise<Partner[]> => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("active", true)
        .neq("tier", "gold")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        logo: r.logo,
        url: r.url,
        description: r.description ?? "",
        coupon_code: r.coupon_code ?? "",
        benefit_text: r.benefit_text ?? "",
        featured: !!r.featured,
        category: r.category ?? "",
      }));
    },
  });

const PartnerCard = ({ partner }: { partner: Partner }) => {
  const Wrapper: any = partner.url ? "a" : "div";
  const wrapperProps = partner.url
    ? { href: partner.url, target: "_blank", rel: "noreferrer" }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="group relative flex h-[190px] flex-col overflow-hidden rounded-xl
                 bg-white/[0.025] border border-white/[0.06]
                 hover:border-brand/25 hover:bg-white/[0.04]
                 transition-all duration-400 ease-out
                 hover:-translate-y-[2px]"
    >
      {/* Logo bar */}
      <div className="relative h-[58px] shrink-0 flex items-center justify-center px-4
                      bg-[#f5f5f5] border-b border-black/5">
        <img
          src={partner.logo}
          alt={partner.name}
          loading="lazy"
          className="max-h-12 max-w-[170px] object-contain
                     transition-transform duration-500 group-hover:scale-105"
        />
        {partner.category && (
          <span className="absolute top-1.5 left-2 inline-flex items-center
                           rounded-full bg-black/80 border border-white/10
                           backdrop-blur-md
                           text-white px-2 py-[2px] text-[8px] font-semibold
                           uppercase tracking-[0.16em]">
            {partner.category}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1 p-2.5 flex-1 min-h-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[13.5px] font-semibold text-white tracking-tight leading-tight truncate">
            {partner.name}
          </h3>
          {partner.url && (
            <ArrowUpRight className="h-3.5 w-3.5 text-white/30 group-hover:text-brand-glow group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
          )}
        </div>

        {partner.description && (
          <p className="text-[11px] text-white/55 leading-snug line-clamp-2">
            {partner.description}
          </p>
        )}

        <div className="mt-auto pt-1.5 border-t border-white/[0.05]">
          {partner.benefit_text ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-brand-glow shadow-[0_0_6px_hsl(var(--accent-brand))]" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-glow">
                  Benefício aluno
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-white/90 font-medium leading-snug line-clamp-1">
                {partner.benefit_text}
              </p>
              {partner.coupon_code && (
                <div className="mt-1 inline-flex items-center gap-1 text-[9px] text-white/35">
                  <Lock className="h-2.5 w-2.5" />
                  Cupom liberado para alunos
                </div>
              )}
            </>
          ) : (
            <div className="text-[10px] text-white/30 uppercase tracking-[0.18em]">Parceiro oficial</div>
          )}
        </div>
      </div>
    </Wrapper>
  );
};

export const PartnersSection = () => {
  const { data: partners = [] } = usePartners();
  if (partners.length === 0) return null;

  // Garante cópias suficientes para o marquee preencher telas largas sem espaço vazio.
  // O keyframe anima translateX de 0 a -50%, então o total de cópias precisa ser par para o loop ser perfeito.
  let copies = Math.max(2, Math.ceil(16 / partners.length));
  if (copies % 2 !== 0) copies += 1;
  const loop = Array.from({ length: copies }, () => partners).flat();
  // Mantém velocidade consistente independente da quantidade de cards.
  const duration = Math.max(35, loop.length * 4);

  return (
    <section
      id="parceiros"
      aria-label="Benefícios para alunos da Corporação"
      className="relative bg-[#070707] text-white overflow-hidden border-t border-white/[0.05] scroll-mt-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at 20% 0%, hsl(var(--accent-brand)/0.06), transparent 55%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent"
      />

      <div className="relative py-8 md:py-10">
        {/* Header */}
        <div className="container-page flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5 md:mb-6">
          <div>
            <div className="inline-flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-brand-glow shadow-[0_0_8px_hsl(var(--accent-brand))]" />
              <span className="text-[10px] font-semibold tracking-[0.28em] uppercase text-brand-glow">
                Todos os parceiros
              </span>
            </div>
            <h2 className="mt-2 font-display text-xl md:text-2xl font-semibold tracking-tight text-white leading-tight">
              Clube de benefícios Corporação
            </h2>
          </div>
          <p className="text-[12px] md:text-[13px] text-white/50 max-w-xs sm:text-right leading-relaxed">
            Marcas parceiras liberam descontos e condições especiais para alunos da Corporação.
          </p>
        </div>

        {/* Mobile: swipeable horizontal scroll */}
        <div className="md:hidden -mx-4 px-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-3 pb-2">
            {partners.map((p) => (
              <div key={p.id} className="snap-start shrink-0 w-[78%] sm:w-[260px]">
                <PartnerCard partner={p} />
              </div>
            ))}
            <div className="shrink-0 w-1" aria-hidden />
          </div>
        </div>

        {/* Desktop: infinite horizontal marquee */}
        <div className="hidden md:block group/marquee relative marquee-mask">
          <div
            className="flex w-max gap-3 md:gap-4 animate-marquee-x will-change-transform"
            style={{ ["--marquee-duration" as any]: `${duration}s` }}
          >
            {loop.map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="w-[230px] lg:w-[260px] shrink-0"
                aria-hidden={i >= partners.length ? true : undefined}
              >
                <PartnerCard partner={p} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
