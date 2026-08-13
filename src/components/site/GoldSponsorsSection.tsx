import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { ArrowUpRight, Ticket, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type GoldPartner = {
  id: string;
  name: string;
  logo: string;
  url: string | null;
  description: string;
  benefit_text: string;
  coupon_code: string;
  category: string;
};

const useGoldPartners = () =>
  useQuery({
    queryKey: ["partners", "gold"],
    queryFn: async (): Promise<GoldPartner[]> => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("active", true)
        .eq("tier", "gold")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        logo: r.logo,
        url: r.url,
        description: r.description ?? "",
        benefit_text: r.benefit_text ?? "",
        coupon_code: r.coupon_code ?? "",
        category: r.category ?? "",
      }));
    },
  });

const GoldCard = ({ partner, index }: { partner: GoldPartner; index: number }) => {
  const { user } = useAuth();
  const isAluno = !!user;
  const Wrapper: any = partner.url ? "a" : "div";
  const wrapperProps = partner.url
    ? { href: partner.url, target: "_blank", rel: "noreferrer" }
    : {};


  return (
    <Wrapper
      {...wrapperProps}
      style={{ animationDelay: `${index * 120}ms` }}
      className="group relative flex flex-col overflow-hidden rounded-2xl
                 bg-gradient-to-b from-white/[0.06] to-white/[0.02]
                 border border-[#c9a84c]/30
                 hover:border-[#e8c878]/70
                 transition-all duration-500 ease-out
                 hover:-translate-y-1
                 shadow-[0_0_0_1px_rgba(201,168,76,0.06),0_20px_60px_-20px_rgba(0,0,0,0.6)]
                 hover:shadow-[0_0_0_1px_rgba(232,200,120,0.22),0_25px_70px_-15px_rgba(201,168,76,0.22)]
                 animate-fade-up [animation-fill-mode:both]"
    >
      {/* Selo Ouro */}
      <div className="absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1
                      rounded-full px-2 py-[3px]
                      bg-gradient-to-r from-[#c9a84c]/90 to-[#e8c878]/90
                      text-[8.5px] font-bold uppercase tracking-[0.22em] text-black/85">
        <span className="h-1 w-1 rounded-full bg-black/70" />
        Ouro
      </div>

      {/* Logo área */}
      <div className="relative h-[78px] md:h-[100px] flex items-center justify-center px-4 md:px-6
                      bg-gradient-to-b from-white/[0.05] to-transparent
                      border-b border-white/[0.05]">
        <img
          src={partner.logo}
          alt={partner.name}
          loading="lazy"
          className="max-h-10 md:max-h-12 max-w-[140px] md:max-w-[160px] object-contain
                     transition-transform duration-700 group-hover:scale-105"
        />
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col gap-1.5 p-3.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-[14px] font-semibold text-white tracking-tight leading-tight truncate">
              {partner.name}
            </h3>
            {partner.category && (
              <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
                {partner.category}
              </div>
            )}
          </div>
          {partner.url && (
            <ArrowUpRight className="h-3.5 w-3.5 text-white/40 group-hover:text-[#e8c878] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
          )}
        </div>

        {/* Bloco de desconto em destaque */}
        {(partner.benefit_text || partner.coupon_code) && (
          <div className="mt-2 rounded-xl border border-[#c9a84c]/25
                          bg-gradient-to-br from-[#c9a84c]/[0.10] to-transparent
                          p-2.5">
            {partner.benefit_text && (
              <p className="mt-1 text-[13px] text-white font-semibold leading-snug line-clamp-2">
                {partner.benefit_text}
              </p>
            )}
            {partner.coupon_code && (
              isAluno ? (
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md
                                bg-black/40 border border-dashed border-[#e8c878]/50
                                px-2 py-1
                                text-[11px] font-mono font-semibold text-[#e8c878]
                                tracking-wider">
                  {partner.coupon_code}
                </div>
              ) : (
                <Link
                  to="/auth"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-md
                             bg-black/40 border border-dashed border-[#e8c878]/40
                             px-2 py-1
                             text-[10px] font-semibold text-[#e8c878]/80 hover:text-[#e8c878]
                             tracking-wider uppercase transition-colors"
                >
                  <Lock className="h-2.5 w-2.5" />
                  Entrar para ver cupom
                </Link>
              )
            )}
          </div>
        )}
      </div>
    </Wrapper>
  );
};

export const GoldSponsorsSection = () => {
  const { data: partners = [] } = useGoldPartners();
  if (partners.length === 0) return null;

  // Grid responsivo, ajusta colunas ao número de patrocinadores (1 a 4 cards)
  const cols =
    partners.length === 1
      ? "md:grid-cols-1 max-w-md mx-auto"
      : partners.length === 2
      ? "md:grid-cols-2 max-w-3xl mx-auto"
      : partners.length === 3
      ? "md:grid-cols-3"
      : "md:grid-cols-2 lg:grid-cols-4";

  return (
    <section
      id="patrocinadores-gold"
      aria-label="Patrocinadores Ouro da Corporação"
      className="relative bg-[#070707] text-white overflow-hidden border-t border-white/[0.05] scroll-mt-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(800px circle at 50% -10%, rgba(201,168,76,0.10), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c]/40 to-transparent"
      />

      <div className="relative container-page py-8 md:py-10">
        {/* Header centralizado */}
        <div className="text-center mb-6 md:mb-8 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2">
            <span className="h-px w-6 bg-[#c9a84c]/60" />
            <span className="text-[10px] font-semibold tracking-[0.32em] uppercase text-[#e8c878]">
              Patrocinadores Ouro
            </span>
            <span className="h-px w-6 bg-[#c9a84c]/60" />
          </div>
          <h2 className="mt-3 font-display text-xl md:text-2xl font-semibold tracking-tight text-white leading-tight">
            Cupons de desconto exclusivos para alunos
          </h2>
          <p className="mt-2 text-[13px] md:text-[14px] text-white/55 leading-relaxed">
            Marcas parceiras liberam descontos e condições especiais para alunos da Corporação.
          </p>
        </div>

        {/* Mobile: carrossel horizontal com auto-scroll */}
        <MobileAutoCarousel partners={partners} />


        {/* Desktop: grid */}
        <div className={`hidden md:grid grid-cols-1 gap-3 md:gap-4 ${cols}`}>
          {partners.map((p, i) => (
            <GoldCard key={p.id} partner={p} index={i} />
          ))}
        </div>

        {/* Dica de scroll no mobile */}
        {partners.length > 1 && (
          <p className="md:hidden mt-2 text-center text-[10px] text-white/40 tracking-wider uppercase">
            Arraste para o lado
          </p>
        )}
      </div>
    </section>
  );
};

const MobileAutoCarousel = ({ partners }: { partners: GoldPartner[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const dirRef = useRef<1 | -1>(1);
  const pausedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onPointerDown = () => { pausedRef.current = true; };
    const onPointerUp = () => { setTimeout(() => { pausedRef.current = false; }, 2500); };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    const id = setInterval(() => {
      if (pausedRef.current || !el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 4) return;
      const card = el.querySelector<HTMLElement>("[data-card]");
      const step = card ? card.offsetWidth + 12 : 200;
      let next = el.scrollLeft + step * dirRef.current;
      if (next >= max - 2) { next = max; dirRef.current = -1; }
      else if (next <= 0) { next = 0; dirRef.current = 1; }
      el.scrollTo({ left: next, behavior: "smooth" });
    }, 3500);

    return () => {
      clearInterval(id);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [partners.length]);

  return (
    <div
      ref={ref}
      className="md:hidden -mx-4 px-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex gap-3 pb-2">
        {partners.map((p, i) => (
          <div key={p.id} data-card className="snap-start shrink-0 w-[68%]">
            <GoldCard partner={p} index={i} />
          </div>
        ))}
        <div className="shrink-0 w-1" aria-hidden />
      </div>
    </div>
  );
};

