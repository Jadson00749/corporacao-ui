import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { PageHero } from "@/components/site/PageHero";
import { CTASection } from "@/components/site/CTASection";
import { SectionHeader } from "@/components/site/SectionHeader";
import { useSettings } from "@/contexts/SettingsContext";
import coachLucas from "@/assets/coach-lucas.jpg";
import coachHelo from "@/assets/coach-helo.jpg";
import coachesRunning from "@/assets/sobre-medalhistas.jpg";
import logoCorporacao from "@/assets/logo-corporacao.png";
import com1 from "@/assets/comunidade-1.jpg.asset.json";
import com2 from "@/assets/comunidade-2.jpg.asset.json";
import com3 from "@/assets/comunidade-3.jpg.asset.json";
import com4 from "@/assets/comunidade-4.jpg.asset.json";

const gallery1 = com3.url;
const gallery3 = com4.url;
const gallery5 = com2.url;
const racesTeam = com1.url;

const highlights = [
  "Treinos presenciais",
  "Fortalecimento para corredores",
  "Equipe para provas",
  "Acompanhamento próximo",
];

const QuemSomos = () => {
  const settings = useSettings();
  const img = settings.images;
  return (
  <Layout>
    <SEO
      title="Quem Somos | Corporação Assessoria Esportiva"
      description="Conheça os professores Lucas Teixeira e Helô Teixeira, fundadores da Corporação Assessoria Esportiva. Natação, corrida e comunidade."
    />
    <PageHero
      title="Quem somos"
      subtitle="Por trás da Corporação estão dois professores de Educação Física que vivem o esporte e cuidam de perto da evolução de cada atleta."
    />

    {/* COACHES */}
    <section className="section-padding">
      <div className="container-page">
        <SectionHeader
          eyebrow="Nossos professores"
          title="Conheça quem treina você"
          subtitle="Formação técnica, vivência como atletas e dedicação total ao esporte."
        />

        <div className="mt-14 grid md:grid-cols-2 gap-8 lg:gap-10">
          {/* Lucas */}
          <article className="group bg-card border border-border rounded-3xl p-6 md:p-7 shadow-card hover-lift">
            <div className="flex gap-5 md:gap-6">
              <div className="relative w-28 sm:w-32 md:w-36 shrink-0 aspect-[3/4] rounded-2xl overflow-hidden bg-secondary ring-1 ring-border">
                <img
                  src={img?.sobreCoach1 || coachLucas}
                  alt="Professor Lucas Teixeira"
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-xl md:text-2xl font-bold leading-tight" style={{ color: "#30FF34" }}>
                  Professor Lucas Teixeira
                </h3>
                <p className="mt-1 inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-foreground/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                  CREF 069.562-G/SP
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Graduado em Educação Física — UNESP/Bauru
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-muted-foreground leading-relaxed text-[0.95rem]">
              <p>
                Desenvolveu trabalho na área da corrida durante toda a sua graduação, atuando como atleta da universidade e da cidade, o que lhe deu amplo conhecimento técnico.
              </p>
              <p>
                De volta à sua cidade, atua ativamente na área do Esporte, sendo professor de Natação e treinador de corrida.
              </p>
            </div>
          </article>

          {/* Helô */}
          <article className="group bg-card border border-border rounded-3xl p-6 md:p-7 shadow-card hover-lift">
            <div className="flex gap-5 md:gap-6">
              <div className="relative w-28 sm:w-32 md:w-36 shrink-0 aspect-[3/4] rounded-2xl overflow-hidden bg-secondary ring-1 ring-border">
                <img
                  src={img?.sobreCoach2 || coachHelo}
                  alt="Professora Helô Teixeira"
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-xl md:text-2xl font-bold leading-tight" style={{ color: "#30FF34" }}>
                  Professora Helô Teixeira
                </h3>
                <p className="mt-1 inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-foreground/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                  CREF 075.875-G/SP
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Graduada em Educação Física — UNAERP
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-muted-foreground leading-relaxed text-[0.95rem]">
              <p>
                Sempre foi uma entusiasta do Esporte, praticando Natação e Handebol durante toda sua juventude.
              </p>
              <p>
                Atua como professora de natação desde 2002 e, há 5 anos, abrangeu a corrida junto com seu esposo, dedicando-se a ambos os esportes.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>

    {/* JUNTOS SOMOS A CORPORAÇÃO */}
    <section className="relative section-padding bg-gradient-dark text-white overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 w-[40rem] h-[40rem] rounded-full opacity-60
                   [background:radial-gradient(circle_at_center,hsl(121_100%_59%/0.22)_0%,transparent_70%)] blur-2xl"
      />
      <div className="container-page relative grid md:grid-cols-2 gap-12 items-center">
        <div className="order-2 md:order-1">
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-brand-glow mb-4">
            Nossa essência
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] text-balance">
            Juntos somos a{" "}
            <span style={{ color: "#30FF34" }}>Corporação</span>
          </h2>
          <p className="mt-6 text-lg text-white/80 leading-relaxed max-w-xl">
            Mais que uma assessoria, somos uma família que acredita no poder do esporte para transformar pessoas. Cada treino, cada prova e cada conquista é construída em equipe.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
              <img src={logoCorporacao} alt="Corporação" className="w-10 h-10 object-contain" />
              <div>
                <p className="font-display font-bold text-sm leading-tight">Corporação</p>
                <p className="text-xs text-white/60 leading-tight">Assessoria Esportiva</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
              <p className="text-xs text-white/60 leading-tight">CREF PJ</p>
              <p className="font-display font-bold text-sm leading-tight">704-PJ/SP</p>
            </div>
          </div>
        </div>

        <div className="order-1 md:order-2 flex justify-center md:justify-end">
          <div className="relative rounded-3xl overflow-hidden shadow-elegant max-w-sm w-full aspect-[4/5]">
            <img
              src={img?.sobreMain || coachesRunning}
              alt="Professores Lucas e Helô Teixeira com medalhas após prova"
              loading="lazy"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </section>

    {/* COMUNIDADE - editorial */}
    <section className="relative section-padding overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--brand) / 0.18) 0%, transparent 70%)" }}
      />
      <div className="container-page relative">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Texto */}
          <div className="lg:col-span-5 lg:sticky lg:top-28">
            <span className="inline-block text-[11px] font-semibold tracking-[0.3em] uppercase text-brand mb-5">
              Nossa comunidade
            </span>
            <h2 className="font-display text-4xl md:text-5xl lg:text-[3.4rem] font-bold leading-[1.05] text-balance">
              Não é só treino.
              <br />
              É constância <span className="gradient-brand-text">em grupo</span>.
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-lg">
              Da primeira caminhada aos 21km, a Corporação nasceu para orientar corredores com método, planilha individual e um Treinão mensal que reúne a equipe.
            </p>

            <ul className="mt-8 space-y-3">
              {highlights.map((h) => (
                <li key={h} className="flex items-center gap-3 text-foreground/85">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                  <span className="text-[0.95rem]">{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mosaico de fotos */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-6 grid-rows-6 gap-3 md:gap-4 h-[520px] md:h-[640px]">
              <div className="col-span-4 row-span-4 relative rounded-2xl overflow-hidden shadow-card group">
                <img
                  src={racesTeam}
                  alt="Equipe da Corporação reunida após a prova"
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <span className="absolute bottom-4 left-4 text-white text-xs font-semibold tracking-wide uppercase">
                  Em equipe nas provas
                </span>
              </div>

              <div className="col-span-2 row-span-3 relative rounded-2xl overflow-hidden shadow-card group">
                <img
                  src={gallery1}
                  alt="Dupla de atletas correndo junta"
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>

              <div className="col-span-2 row-span-3 relative rounded-2xl overflow-hidden shadow-card group">
                <img
                  src={gallery5}
                  alt="Atleta da Corporação sorrindo no treino"
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>

              <div className="col-span-3 row-span-2 relative rounded-2xl overflow-hidden shadow-card group">
                <img
                  src={gallery3}
                  alt="Atleta comemorando no alto do mirante"
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>

              <div className="col-span-3 row-span-2 relative rounded-2xl overflow-hidden bg-gradient-dark text-white p-5 flex flex-col justify-between shadow-card">
                <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-brand-glow">
                  Desde a primeira passada
                </span>
                <p className="font-display text-lg md:text-xl leading-tight">
                  Pessoas reais, treinando juntas, semana após semana.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <CTASection />
  </Layout>
  );
};

export default QuemSomos;
