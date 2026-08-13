import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { useWhatsappLink } from "@/contexts/SettingsContext";
import logoCorporacao from "@/assets/logo-corporacao.png";

export const CTASection = () => {
  const whatsappLink = useWhatsappLink();

  return (
    <section className="relative section-padding overflow-hidden bg-[#080808] text-white">
      {/* Giant watermark logo */}
      <img
        src={logoCorporacao}
        alt=""
        aria-hidden
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[780px] max-w-none opacity-[0.025]"
      />

      {/* Soft organic green glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 w-[620px] h-[620px] rounded-full opacity-[0.18] blur-[140px]"
        style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 w-[520px] h-[520px] rounded-full opacity-[0.14] blur-[140px]"
        style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
      />

      {/* Subtle radial light from top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--brand) / 0.06) 0%, transparent 70%)",
        }}
      />

      {/* Top hairline */}
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, hsl(var(--brand) / 0.4), transparent)",
        }}
      />

      <div className="container-page relative">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-[11px] font-semibold tracking-[0.3em] uppercase text-brand/90 mb-5">
            Corporação Assessoria Esportiva
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] text-balance">
            Treinar fica diferente com método e acompanhamento.
          </h2>
          <p className="mt-5 text-lg text-white/70 leading-relaxed max-w-xl mx-auto">
            Planilha individual no seu app, coach acompanhando cada treino e o Treinão da equipe uma vez por mês.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Button asChild variant="brand" size="lg" className="rounded-full">
              <a
                href={whatsappLink(
                  "Olá! Quero treinar com a equipe da Corporação."
                )}
                target="_blank"
                rel="noreferrer"
              >
                Quero treinar com a equipe <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white hover:border-white/30"
            >
              <Link to="/planos">Conhecer os planos</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
