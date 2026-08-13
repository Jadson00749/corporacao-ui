import { Check } from "lucide-react";
import { SectionHeader } from "@/components/site/SectionHeader";
import { useSettings } from "@/contexts/SettingsContext";
import heroImg from "@/assets/training-method-hero.png";
import appMockup from "@/assets/training-app-mockup.png";
import tpLogo from "@/assets/trainingpeaks-logo.png";

const features = [
  "Planilha de corrida personalizada",
  "Treino de musculação integrado",
  "Feedback direto dos treinadores",
  "Análise de fadiga e recuperação",
];

export const TrainingPeaksSection = () => {
  const settings = useSettings();
  const heroSrc = settings.images?.trainingPeaksHero || heroImg;
  const appSrc = settings.images?.trainingPeaksApp || appMockup;
  return (
    <section className="relative section-padding bg-[#080808] text-white overflow-hidden">
      {/* Halo verde discreto */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-32 w-[560px] h-[560px] rounded-full opacity-[0.10] blur-[140px]"
        style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
      />
      {/* Imagem de fundo cinematográfica */}
      <img
        src={heroSrc}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover opacity-[0.18] [filter:grayscale(0.4)_contrast(1.05)]"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#070707] via-[#070707]/80 to-[#070707]/30" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#070707] via-transparent to-[#070707]/50" />

      <div className="container-page relative">
        <SectionHeader
          eyebrow="Tecnologia + método"
          title="O treino com a precisão dos atletas de elite."
          subtitle="Cada sessão é planejada, medida e ajustada com base nos seus dados, para você evoluir com clareza e segurança."
          light
        />

        <div className="mt-16 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center max-w-6xl mx-auto">
          {/* Texto editorial */}
          <div>
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] mb-7">
              <div className="w-7 h-7 rounded-md bg-[#0a1d4a] flex items-center justify-center">
                <img src={tpLogo} alt="TrainingPeaks" className="w-5 h-5 object-contain" />
              </div>
              <span className="text-[11px] font-semibold tracking-[0.28em] uppercase text-white/80">
                Powered by TrainingPeaks
              </span>
            </div>

            <h3 className="font-display text-2xl md:text-[2rem] font-semibold leading-[1.15] tracking-[-0.01em] text-balance">
              A mesma plataforma usada
              <span className="block font-light text-white/75">
                pelos <span className="text-brand font-semibold">melhores atletas do mundo.</span>
              </span>
            </h3>

            <p className="mt-5 text-[15px] text-white/65 leading-[1.75] max-w-md">
              Volume, intensidade, fadiga e recuperação acompanhados de perto. Você treina com método e enxerga sua evolução em números.
            </p>

            <ul className="mt-8 space-y-3.5 max-w-md">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[14px] text-white/85">
                  <span className="mt-0.5 w-5 h-5 rounded-full border border-brand/40 bg-brand/10 text-brand flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" strokeWidth={2.5} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <p className="mt-8 text-[11px] tracking-[0.2em] uppercase text-white/35">
              Serviço opcional via TrainingPeaks
            </p>
          </div>

          {/* Mockup com vinheta */}
          <div className="relative flex justify-center lg:justify-end">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full opacity-30 blur-3xl"
              style={{ background: "radial-gradient(circle at center, hsl(var(--brand) / 0.4), transparent 60%)" }}
            />
            <img
              src={appSrc}
              alt="App TrainingPeaks no celular e Apple Watch"
              loading="lazy"
              className="relative w-[300px] md:w-[380px] xl:w-[440px] h-auto object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
