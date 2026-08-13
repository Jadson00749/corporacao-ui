import { useState } from "react";
import { MessageCircle, Instagram, Mail, MapPin, Zap, Users, HeartHandshake, Clock, ArrowRight } from "lucide-react";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings, useWhatsappLink } from "@/contexts/SettingsContext";
import coachesDuo from "@/assets/coaches-duo.jpg";

const goals = [
  "Começar a correr",
  "Melhorar performance",
  "Fortalecimento",
  "Participar de provas",
];

const highlights = [
  { icon: Clock, label: "Resposta rápida" },
  { icon: Users, label: "Treinos presenciais" },
  { icon: HeartHandshake, label: "Equipe real" },
  { icon: Zap, label: "Suporte próximo" },
];

const Contato = () => {
  const siteSettings = useSettings();
  const whatsappLink = useWhatsappLink();
  const [form, setForm] = useState({ name: "", whatsapp: "", goal: "" });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = `Olá! Sou ${form.name} (${form.whatsapp}). Meu objetivo é: ${form.goal || "treinar com a equipe"}.`;
    window.open(whatsappLink(msg), "_blank");
  };

  const channels = [
    {
      icon: MessageCircle,
      title: "WhatsApp",
      value: siteSettings.contact.whatsappDisplay,
      hint: "Mais rápido",
      href: whatsappLink("Olá! Vim pelo site da Corporação."),
    },
    {
      icon: Instagram,
      title: "Instagram",
      value: siteSettings.contact.instagramHandle,
      hint: "Bastidores da equipe",
      href: siteSettings.contact.instagram,
    },
    {
      icon: Mail,
      title: "E-mail",
      value: siteSettings.contact.email,
      hint: "Para assuntos formais",
      href: `mailto:${siteSettings.contact.email}`,
    },
    {
      icon: MapPin,
      title: "Onde treinamos",
      value: siteSettings.contact.region,
      hint: "Pontos de encontro",
    },
  ];

  return (
    <Layout>
      <SEO
        title="Contato | Corporação Assessoria Esportiva"
        description={`Fale com a Corporação pelo WhatsApp ${siteSettings.contact.whatsappDisplay}. Treinos, planos e provas.`}
      />

      {/* HERO */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-[#080808] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-32 w-[620px] h-[620px] rounded-full opacity-[0.18] blur-[140px]"
          style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-20 w-[520px] h-[520px] rounded-full opacity-[0.12] blur-[140px]"
          style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, hsl(var(--brand) / 0.06) 0%, transparent 70%)",
          }}
        />

        <div className="container-page relative grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.3em] uppercase text-brand/90 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              Fale com a equipe
            </span>
            <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] text-balance">
              Seu próximo treino <br className="hidden md:block" />
              <span className="text-brand">começa aqui.</span>
            </h1>
            <p className="mt-5 text-lg text-white/70 max-w-xl leading-relaxed">
              Chama a equipe no WhatsApp e tire suas dúvidas sobre treinos, planos e provas.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="brand" size="lg" className="rounded-full">
                <a
                  href={whatsappLink("Olá! Quero saber mais sobre os treinos da Corporação.")}
                  target="_blank"
                  rel="noreferrer"
                >
                  Chamar no WhatsApp <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white hover:border-white/30"
              >
                <a href={siteSettings.contact.instagram} target="_blank" rel="noreferrer">
                  Ver no Instagram
                </a>
              </Button>
            </div>

            <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 max-w-md">
              {highlights.map((h) => (
                <li key={h.label} className="flex items-center gap-2.5 text-sm text-white/75">
                  <span className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <h.icon className="w-3.5 h-3.5 text-brand" />
                  </span>
                  {h.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Foto humana */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2rem] opacity-40 blur-3xl"
              style={{ background: "radial-gradient(circle at 30% 30%, hsl(var(--brand) / 0.35), transparent 60%)" }}
            />
            <div className="relative aspect-[3/4] rounded-[1.75rem] overflow-hidden border border-white/10 shadow-brand">
              <img
                src={siteSettings.images?.contato || coachesDuo}
                alt="Treino da equipe Corporação com Lucas e Helô"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <a
                href={whatsappLink("Olá Lucas e Helô! Vim pelo site da Corporação.")}
                target="_blank"
                rel="noreferrer"
                className="group absolute bottom-5 left-5 right-5 flex items-center justify-between gap-3 p-3 pl-4 rounded-2xl bg-white/[0.06] border border-white/15 backdrop-blur-md hover:bg-white/[0.10] hover:border-success/40 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="relative flex shrink-0">
                    <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
                    <span className="relative w-2.5 h-2.5 rounded-full bg-success ring-2 ring-success/30" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] tracking-[0.22em] uppercase text-white/60">Lucas e Helô</p>
                    <p className="font-display text-sm font-semibold leading-tight truncate">Online no WhatsApp agora</p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 rounded-full bg-success/15 border border-success/30 text-success-foreground text-success group-hover:bg-success group-hover:text-white transition-colors">
                  conversar
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CONTATO */}
      <section className="relative section-padding bg-[#0a0a0a] text-white overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full opacity-[0.10] blur-[140px]"
          style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
        />

        <div className="container-page relative grid lg:grid-cols-[1fr_1.1fr] gap-12 max-w-6xl mx-auto">
          {/* Canais */}
          <div>
            <span className="inline-block text-[11px] font-semibold tracking-[0.3em] uppercase text-brand/90 mb-3">
              Canais diretos
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-8 leading-tight">
              Onde a gente conversa.
            </h2>

            <div className="space-y-3">
              {channels.map((c) => {
                const inner = (
                  <div className="group relative flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-brand/40 transition-all duration-300">
                    <div className="relative w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-brand/40 transition-colors">
                      <c.icon className="w-5 h-5 text-brand" />
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ boxShadow: "0 0 24px hsl(var(--brand) / 0.35)" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-white/50">{c.title}</p>
                      <p className="font-display font-semibold truncate">{c.value}</p>
                    </div>
                    <span className="hidden sm:inline-block text-[10px] tracking-[0.18em] uppercase text-white/40 group-hover:text-brand/80 transition-colors">
                      {c.hint}
                    </span>
                  </div>
                );
                return c.href ? (
                  <a key={c.title} href={c.href} target="_blank" rel="noreferrer" className="block">
                    {inner}
                  </a>
                ) : (
                  <div key={c.title}>{inner}</div>
                );
              })}
            </div>
          </div>

          {/* Formulário */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-4 rounded-[2rem] opacity-30 blur-3xl"
              style={{ background: "radial-gradient(circle at 70% 20%, hsl(var(--brand) / 0.3), transparent 60%)" }}
            />
            <form
              onSubmit={onSubmit}
              className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-6 md:p-8"
            >
              <span className="inline-block text-[11px] font-semibold tracking-[0.3em] uppercase text-brand/90 mb-2">
                Conta pra gente
              </span>
              <h3 className="font-display text-2xl md:text-3xl font-bold leading-tight mb-1">
                Bora começar?
              </h3>
              <p className="text-sm text-white/60 mb-6">
                Preenche rapidinho e a gente te chama no WhatsApp.
              </p>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-white/80">Nome</Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Como podemos te chamar?"
                    className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:border-brand/60 focus-visible:ring-brand/30"
                  />
                </div>
                <div>
                  <Label htmlFor="whatsapp" className="text-white/80">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    required
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="(11) 9 9999-9999"
                    className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:border-brand/60 focus-visible:ring-brand/30"
                  />
                </div>
                <div>
                  <Label className="text-white/80">Objetivo</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {goals.map((g) => {
                      const active = form.goal === g;
                      return (
                        <button
                          type="button"
                          key={g}
                          onClick={() => setForm({ ...form, goal: g })}
                          className={`text-xs px-3.5 py-2 rounded-full border transition-all ${
                            active
                              ? "bg-brand text-brand-foreground border-brand shadow-brand"
                              : "bg-white/[0.04] text-white/75 border-white/10 hover:border-brand/40 hover:text-white"
                          }`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <Button type="submit" variant="brand" size="lg" className="w-full mt-7 rounded-full">
                Quero correr com a equipe <ArrowRight className="w-4 h-4" />
              </Button>
              <p className="text-[11px] text-white/40 text-center mt-3">
                Sua mensagem vai direto pro WhatsApp da equipe.
              </p>
            </form>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contato;
