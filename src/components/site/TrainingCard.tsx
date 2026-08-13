import { Calendar, Clock, MapPin, ArrowRight } from "lucide-react";
import { Training } from "@/data/trainings";
import { Button } from "@/components/ui/button";
import { useWhatsappLink, useSettings } from "@/contexts/SettingsContext";
import imgGroup from "@/assets/coaches-running.jpg";
import imgRaces from "@/assets/benefit-races-team.jpg";
import imgGallery3 from "@/assets/gallery-3.jpg";
import imgGallery1 from "@/assets/gallery-1.jpg";
import imgGallery5 from "@/assets/gallery-5.jpg";

const TRAINING_PHOTOS = [imgGroup, imgRaces, imgGallery3, imgGallery1, imgGallery5];

const formatDate = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
};

const pickPhoto = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TRAINING_PHOTOS[h % TRAINING_PHOTOS.length];
};

const buildVibeLabel = (training: Training) => {
  const t = training.title.toLowerCase();
  if (t.includes("longão") || t.includes("longao")) return "Longão da equipe";
  if (t.includes("tiros") || t.includes("pista") || t.includes("velocidade")) return "Velocidade em pista";
  if (t.includes("regenerativo") || t.includes("leve") || t.includes("trote")) return "Corrida leve";
  if (t.includes("ritmo") || t.includes("limiar") || t.includes("threshold")) return "Treino de ritmo";
  if (t.includes("subida") || t.includes("morro") || t.includes("trail")) return "Subidas e força";
  if (t.includes("pace") || t.includes("peace") || t.includes("yoga")) return "Treino aberto";
  if (training.time && parseInt(training.time) < 9) return "Rodagem da manhã";
  return "Treino com a equipe";
};

// Mapeia a string da proporção (vinda do admin) para uma classe Tailwind segura.
const aspectClass = (aspect: string) => {
  switch (aspect) {
    case "1/1": return "aspect-square";
    case "16/10": return "aspect-[16/10]";
    case "4/5": return "aspect-[4/5]";
    case "3/4": return "aspect-[3/4]";
    case "9/16":
    default: return "aspect-[9/16]";
  }
};

export const TrainingCard = ({ training }: { training: Training }) => {
  const whatsappLink = useWhatsappLink();
  const settings = useSettings();
  const photo = training.image && training.image.trim().length > 0 ? training.image : pickPhoto(training.id);
  const vibe = buildVibeLabel(training);
  const waMsg = `Olá! Quero participar do treino "${training.title}" da Corporação.`;
  const aspect = aspectClass(settings?.trainings?.bannerAspect ?? "9/16");

  return (
    <article className="group relative bg-card rounded-2xl border border-border/60 flex flex-col h-full overflow-hidden transition-all duration-500 hover:border-brand/40 hover:-translate-y-1">
      {/* Photo */}
      <div className={`relative ${aspect} overflow-hidden bg-muted`}>
        <img
          src={photo}
          alt={training.title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.22em] uppercase px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-white backdrop-blur-sm">
          {vibe}
        </span>
      </div>


      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <h3 className="font-display text-lg font-semibold text-foreground leading-snug group-hover:text-brand transition-colors">
          {training.title}
        </h3>

        <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-brand" />
            <span className="capitalize">{formatDate(training.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-brand" />
            <span>{training.time}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" />
            <span>{training.location}</span>
          </div>
        </div>

        <p className="mt-4 text-sm text-foreground/70 leading-relaxed flex-1">
          {training.description}
        </p>

        <div className="mt-6 space-y-2">
          <Button asChild variant="brand" className="w-full rounded-full">
            <a href={whatsappLink(waMsg)} target="_blank" rel="noreferrer">
              Treinar com a equipe <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
          {training.mapUrl && (
            <a
              href={training.mapUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-brand transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" /> ver localização
            </a>
          )}
        </div>
      </div>
    </article>
  );
};
