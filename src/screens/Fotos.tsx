import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { PageHero } from "@/components/site/PageHero";
import { PhotoEventCard } from "@/components/site/PhotoEventCard";
import { CTASection } from "@/components/site/CTASection";
import { usePhotoEvents } from "@/hooks/useContent";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera } from "lucide-react";

const Fotos = () => {
  const { data: events = [], isLoading } = usePhotoEvents();

  return (
    <Layout>
      <SEO
        title="Fotos dos eventos | Corporação Assessoria Esportiva"
        description="Links oficiais para visualizar as fotos dos nossos treinos, provas e eventos."
      />
      <PageHero
        eyebrow="Memórias da equipe"
        title="Cada prova, cada treino, registrado."
        subtitle="Os links oficiais das fotos dos nossos eventos, treinos e travessias."
      />

      <section className="section-padding">
        <div className="container-page">
          <div className="max-w-3xl mx-auto mb-14 flex items-start gap-5 border-l-2 border-brand/60 pl-6 py-2">
            <Camera className="w-5 h-5 text-brand mt-1 shrink-0" />
            <p className="text-sm md:text-base text-foreground/75 leading-relaxed font-light">
              Após cada treino ou prova publicamos aqui os links oficiais. Ao clicar, você é direcionado para a plataforma parceira responsável pelas imagens.
            </p>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-muted-foreground">
              Nenhum evento de fotos cadastrado ainda. Volte em breve!
            </p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((e) => <PhotoEventCard key={e.id} event={e} />)}
            </div>
          )}
        </div>
      </section>

      <CTASection />
    </Layout>
  );
};

export default Fotos;
