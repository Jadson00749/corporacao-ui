import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/router-compat";

import { supabase } from "@/integrations/supabase/client";

type Highlight = {
  id: string;
  title: string;
  subtitle: string;
  eyebrow: string;
  image: string;
  image_position: string | null;
  image_fit: string | null;
  button_label: string;
  button_link: string;
};

const useHomeHighlights = () =>
  useQuery({
    queryKey: ["home_highlights"],
    queryFn: async (): Promise<Highlight[]> => {
      const { data, error } = await supabase
        .from("home_highlights")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Highlight[];
    },
    staleTime: 5 * 60 * 1000,
  });

const isExternal = (url: string) => /^(https?:)?\/\//.test(url) || url.startsWith("mailto:") || url.startsWith("tel:");

export const HomeHighlightCarousel = () => {
  const { data: items = [] } = useHomeHighlights();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 6000);
    return () => clearInterval(id);
  }, [items.length]);

  if (!items.length) return null;

  return (
    <section className="relative bg-background py-10 sm:py-14">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.5)]">
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {items.map((item) => {
              const btn = item.button_label?.trim();
              const link = item.button_link?.trim();
              const hasLink = !!link;
              const external = hasLink && isExternal(link);

              const ButtonEl = btn && hasLink ? (
                external ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-12 text-sm font-semibold shadow-[0_10px_28px_-10px_hsl(var(--brand)/0.55)] hover:shadow-[0_14px_36px_-10px_hsl(var(--brand)/0.7)] active:scale-[0.98] transition-all"
                  >
                    {btn} <ArrowRight className="w-4 h-4" />
                  </a>
                ) : (
                  <Link
                    to={link}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 h-12 text-sm font-semibold shadow-[0_10px_28px_-10px_hsl(var(--brand)/0.55)] hover:shadow-[0_14px_36px_-10px_hsl(var(--brand)/0.7)] active:scale-[0.98] transition-all"
                  >
                    {btn} <ArrowRight className="w-4 h-4" />
                  </Link>
                )
              ) : null;

              const cardInner = (
                <article
                  className={`relative w-full shrink-0 grid md:grid-cols-[1.1fr_1fr] min-h-[280px] md:min-h-[340px] ${hasLink ? "cursor-pointer group" : ""}`}
                >
                  {item.image && (
                    <div className="relative h-56 md:h-full md:order-2 overflow-hidden bg-card">
                      <img
                        src={item.image}
                        alt={item.title || "Destaque"}
                        className={`absolute inset-0 w-full h-full transition-transform duration-700 ${hasLink ? "group-hover:scale-[1.03]" : ""}`}
                        style={{
                          objectFit: (item.image_fit?.trim() || "cover") as any,
                          objectPosition: item.image_position?.trim() || "center",
                        }}
                        loading="lazy"
                      />
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-card via-card/40 to-transparent md:from-card md:via-card/60 md:to-transparent" />
                    </div>
                  )}
                  <div className="relative p-6 sm:p-8 md:p-12 flex flex-col justify-center md:order-1">
                    {item.eyebrow && (
                      <span className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.28em] uppercase text-brand mb-4 self-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                        {item.eyebrow}
                      </span>
                    )}
                    <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-[-0.02em] leading-tight text-foreground">
                      {item.title}
                    </h2>
                    {item.subtitle && (
                      <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-lg">
                        {item.subtitle}
                      </p>
                    )}
                    {ButtonEl && <div className="mt-6">{ButtonEl}</div>}
                  </div>
                </article>
              );

              if (!hasLink) {
                return <div key={item.id} className="w-full shrink-0">{cardInner}</div>;
              }
              if (external) {
                return (
                  <a
                    key={item.id}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.title || "Abrir destaque"}
                    className="w-full shrink-0 block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {cardInner}
                  </a>
                );
              }
              return (
                <Link
                  key={item.id}
                  to={link}
                  aria-label={item.title || "Abrir destaque"}
                  className="w-full shrink-0 block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {cardInner}
                </Link>
              );
            })}
          </div>

          {items.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`Destaque ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-6 bg-brand" : "w-1.5 bg-foreground/30 hover:bg-foreground/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
