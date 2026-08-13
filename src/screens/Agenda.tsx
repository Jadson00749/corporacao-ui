import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { PageHero } from "@/components/site/PageHero";
import { AgendaCalendar } from "@/components/site/AgendaCalendar";

const Agenda = () => {
  return (
    <Layout>
      <SEO
        title="Agenda de treinos e provas | Corporação Assessoria"
        description="Veja em um só lugar todos os treinos da equipe e as próximas provas no calendário do mês."
      />
      <PageHero
        title="Agenda do mês"
        subtitle="Treinos e provas em um só calendário. Tire um print e compartilhe com quem você quer trazer junto."
      />
      <section className="section-padding pt-8">
        <div className="container-page max-w-5xl">
          <AgendaCalendar />
        </div>
      </section>
    </Layout>
  );
};

export default Agenda;
