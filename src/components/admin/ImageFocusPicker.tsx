import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src?: string;
  position: string;
  fit: string;
  onChange: (position: string, fit: string) => void;
};

const POSITIONS: { value: string; label: string }[] = [
  { value: "left top", label: "Topo Esq." },
  { value: "center top", label: "Topo" },
  { value: "right top", label: "Topo Dir." },
  { value: "left center", label: "Esquerda" },
  { value: "center center", label: "Centro" },
  { value: "right center", label: "Direita" },
  { value: "left bottom", label: "Base Esq." },
  { value: "center bottom", label: "Base" },
  { value: "right bottom", label: "Base Dir." },
];

const normalize = (p?: string) => {
  if (!p) return "center center";
  const t = p.trim().toLowerCase();
  if (t === "center") return "center center";
  if (t === "top") return "center top";
  if (t === "bottom") return "center bottom";
  if (t === "left") return "left center";
  if (t === "right") return "right center";
  return t;
};

export const ImageFocusPicker = ({ src, position, fit, onChange }: Props) => {
  const currentPos = useMemo(() => normalize(position), [position]);
  const currentFit = (fit?.trim() || "cover") as "cover" | "contain";

  return (
    <div className="mt-2 space-y-3">
      {!src && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Envie uma imagem acima para ajustar o enquadramento.
        </div>
      )}

      {src && (
        <>
          {/* Live preview matching the home banner look */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">
              Pré-visualização (como vai aparecer na home)
            </div>
            <div className="relative w-full aspect-[16/7] rounded-xl overflow-hidden border border-border bg-card shadow-sm">
              {/* image side mimics ~45% width like the real banner */}
              <div className="absolute inset-y-0 right-0 w-[55%] bg-card overflow-hidden">
                <img
                  src={src}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: currentFit, objectPosition: currentPos }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-r from-card via-card/60 to-transparent"
                />
              </div>
              {/* fake text side */}
              <div className="absolute inset-y-0 left-0 w-[55%] p-4 flex flex-col justify-center gap-2">
                <div className="h-1.5 w-12 rounded bg-brand/60" />
                <div className="h-3 w-3/4 rounded bg-foreground/80" />
                <div className="h-2 w-1/2 rounded bg-muted-foreground/60" />
                <div className="mt-2 h-5 w-20 rounded-full bg-brand/70" />
              </div>
            </div>
          </div>

          {/* Fit toggle */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">
              Como a foto preenche o espaço
            </div>
            <div className="inline-flex rounded-lg border border-border p-1 bg-background">
              <button
                type="button"
                onClick={() => onChange(currentPos, "cover")}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md transition-colors",
                  currentFit === "cover"
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Preencher (corta bordas)
              </button>
              <button
                type="button"
                onClick={() => onChange(currentPos, "contain")}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md transition-colors",
                  currentFit === "contain"
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Mostrar foto inteira
              </button>
            </div>
          </div>

          {/* 3x3 position grid */}
          {currentFit === "cover" && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                Qual parte da foto deve ficar visível
              </div>
              <div className="grid grid-cols-3 gap-1.5 max-w-[260px]">
                {POSITIONS.map((p) => {
                  const active = currentPos === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onChange(p.value, currentFit)}
                      title={p.label}
                      className={cn(
                        "relative aspect-square rounded-md border transition-all overflow-hidden",
                        active
                          ? "border-brand ring-2 ring-brand/40"
                          : "border-border hover:border-brand/50"
                      )}
                    >
                      <img
                        src={src}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ objectPosition: p.value }}
                      />
                      {active && (
                        <span className="absolute bottom-0 inset-x-0 text-[9px] font-semibold uppercase tracking-wider bg-brand text-brand-foreground py-0.5 text-center">
                          {p.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Clique em uma das 9 opções. Cada miniatura mostra exatamente o que vai aparecer.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
