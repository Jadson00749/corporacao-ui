import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
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

const PartnerCard = ({ partner, mobile = false }: { partner: Partner; mobile?: boolean }) => {
  const Wrapper: any = partner.url ? "a" : "div";
  const wrapperProps = partner.url
    ? { href: partner.url, target: "_blank", rel: "noreferrer" }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`group relative flex flex-col overflow-hidden rounded-xl
                 bg-[#f5f5f5] border border-black/5
                 hover:shadow-lg hover:-translate-y-1
                 transition-all duration-300 ease-out ${mobile ? "h-[176px]" : "h-[130px]"}`}
    >
      {/* Logo area */}
      <div className={`relative flex-1 flex items-center justify-center ${mobile ? "px-5 py-5" : "p-3"}`}>
        <img
          src={partner.logo}
          alt={partner.name}
          loading="lazy"
          className={`object-contain transition-transform duration-500 group-hover:scale-105 ${
            mobile ? "max-h-24 w-auto max-w-[80%]" : "max-h-16 max-w-[180px]"
          }`}
        />
        {partner.category && (
          <span className={`absolute inline-flex items-center
                           rounded-full bg-black/80
                           text-white font-semibold uppercase tracking-[0.16em]
                           ${mobile ? "top-3 left-3 px-2.5 py-[3px] text-[9px]" : "top-2 left-2 px-2 py-[2px] text-[8px]"}`}>
            {partner.category}
          </span>
        )}
      </div>

      {/* Name bar */}
      <div className={`flex items-center justify-between gap-2 bg-white border-t border-black/5 ${
        mobile ? "px-4 py-3" : "px-3 py-2"
      }`}>
        <h3 className={`font-display font-semibold text-black/90 tracking-tight leading-tight truncate ${
          mobile ? "text-[14px]" : "text-[12px]"
        }`}>
          {partner.name}
        </h3>
        {partner.url && (
          <ArrowUpRight className={`text-black/40 group-hover:text-black/70 transition-all shrink-0 ${
            mobile ? "h-4 w-4" : "h-3.5 w-3.5"
          }`} />
        )}
      </div>
    </Wrapper>
  );
};

const MobilePartnersCarousel = ({ partners }: { partners: Partner[] }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    if (!card) return;
    const step = card.offsetWidth + 12;
    setActive(Math.min(partners.length - 1, Math.round(el.scrollLeft / step)));
  };

  return (
    <div className="md:hidden">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex gap-3 pb-2">
          {partners.map((p) => (
            <div key={p.id} data-card className="snap-start shrink-0 w-[84%]">
              <PartnerCard partner={p} mobile />
            </div>
          ))}
          <div className="shrink-0 w-1" aria-hidden />
        </div>
      </div>

      {partners.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {partners.map((p, i) => (
            <span
              key={p.id}
              aria-hidden
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-5 bg-brand" : "w-1.5 bg-white/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
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

        {/* Mobile: 1 card por vez com scroll-snap */}
        <MobilePartnersCarousel partners={partners} />

        {/* Desktop: infinite horizontal marquee */}
        <div className="hidden md:block group/marquee relative marquee-mask">
          <div
            className="flex w-max gap-3 md:gap-4 animate-marquee-x will-change-transform"
            style={{ ["--marquee-duration" as any]: `${duration}s` }}
          >
            {loop.map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="w-[180px] lg:w-[200px] shrink-0"
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
