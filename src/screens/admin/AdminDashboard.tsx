import { Link } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { usePlans, useTrainings, useEvents, useProducts, useGallery, useTestimonials, useFaqs } from "@/hooks/useContent";

const Card = ({ title, count, to }: { title: string; count: number; to: string }) => (
  <Link to={to} className="bg-card border border-border rounded-xl p-6 hover-lift block">
    <div className="text-sm text-muted-foreground">{title}</div>
    <div className="font-display text-3xl font-bold mt-1">{count}</div>
  </Link>
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const { data: plans = [] } = usePlans();
  const { data: trainings = [] } = useTrainings();
  const { data: events = [] } = useEvents();
  const { data: products = [] } = useProducts();
  const { data: gallery = [] } = useGallery();
  const { data: testimonials = [] } = useTestimonials();
  const { data: faqs = [] } = useFaqs();

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Olá, {user?.email?.split("@")[0]} 👋</h1>
      <p className="text-muted-foreground mt-1">Painel de administração do site PACE.</p>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card title="Planos" count={plans.length} to="/admin/plans" />
        <Card title="Treinos" count={trainings.length} to="/admin/trainings" />
        <Card title="Provas" count={events.length} to="/admin/events" />
        <Card title="Produtos" count={products.length} to="/admin/products" />
        <Card title="Fotos" count={gallery.length} to="/admin/gallery" />
        <Card title="Depoimentos" count={testimonials.length} to="/admin/testimonials" />
        <Card title="FAQs" count={faqs.length} to="/admin/faqs" />
      </div>
    </div>
  );
};

export default AdminDashboard;
