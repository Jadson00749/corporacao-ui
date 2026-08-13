import { Calendar, MapPin, ExternalLink, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PhotoEvent } from "@/data/photoEvents";

const statusStyle: Record<PhotoEvent["status"], string> = {
  "Fotos disponíveis": "bg-success text-white",
  "Em breve": "bg-warning text-primary",
  "Encerrado": "bg-muted text-muted-foreground",
};

const formatDate = (iso: string | null) => {
  if (!iso) return "Data a definir";
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export const PhotoEventCard = ({ event }: { event: PhotoEvent }) => {
  const hasLink = !!event.photoLink && event.photoLink.trim() !== "";
  const soon = event.status === "Em breve";
  const closed = event.status === "Encerrado";

  // Link funciona sempre que houver URL preenchida — status é apenas o rótulo visual.
  const available = hasLink;

  let label = "Ver fotos";
  if (!hasLink && soon) label = "Fotos em breve";
  else if (!hasLink && closed) label = "Indisponível";
  else if (!hasLink) label = "Indisponível";

  const disabled = !available;

  return (
    <article
      className={cn(
        "group rounded-2xl border border-border bg-card overflow-hidden shadow-card hover-lift flex flex-col h-full",
        disabled && "opacity-80"
      )}
    >
      {event.coverImage ? (
        <div className="aspect-[16/9] overflow-hidden bg-secondary relative">
          <img
            src={event.coverImage}
            alt={event.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <span
            className={cn(
              "absolute top-4 right-4 text-xs font-semibold px-3 py-1 rounded-full",
              statusStyle[event.status]
            )}
          >
            {event.status}
          </span>
        </div>
      ) : (
        <div className="bg-gradient-dark p-6 text-white relative">
          <span
            className={cn(
              "absolute top-4 right-4 text-xs font-semibold px-3 py-1 rounded-full",
              statusStyle[event.status]
            )}
          >
            {event.status}
          </span>
          <Camera className="w-7 h-7 text-brand-glow mb-3" />
          <h3 className="font-display text-xl font-bold pr-28">{event.title}</h3>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col">
        {event.coverImage && (
          <h3 className="font-display text-xl font-bold mb-3">{event.title}</h3>
        )}

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand" />
            <span>{formatDate(event.date)}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand" />
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {event.description && (
          <p className="mt-4 text-sm text-foreground/70 leading-relaxed flex-1">
            {event.description}
          </p>
        )}

        <Button
          asChild={available}
          variant={available ? "brand" : "outline"}
          className="mt-6 w-full"
          disabled={disabled}
        >
          {available ? (
            <a href={event.photoLink} target="_blank" rel="noreferrer">
              {label} <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <span>{label}</span>
          )}
        </Button>
      </div>
    </article>
  );
};
