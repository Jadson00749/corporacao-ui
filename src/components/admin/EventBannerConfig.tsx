import { useState } from "react";
import { Upload, X, Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BANNER_ASPECT_OPTIONS,
  bannerRatioStyle,
  normalizeBannerAspect,
} from "@/lib/bannerAspect";

type Props = {
  aspect?: string | null;
  bannerImage?: string | null;
  mobileImage?: string | null;
  onChange: (patch: Record<string, any>) => void;
  onUploadBanner: (file: File) => void;
  onUploadMobile: (file: File) => void;
};

const Preview = ({
  src,
  aspect,
  device,
}: {
  src?: string | null;
  aspect: string;
  device: "mobile" | "desktop";
}) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-xl border border-border bg-[#0b0b0b] mx-auto",
      device === "mobile" ? "w-[220px]" : "w-full max-w-[520px]"
    )}
    style={device === "mobile" ? bannerRatioStyle(aspect) : { aspectRatio: "16 / 9" }}
  >
    {src ? (
      <>
        <img src={src} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40" />
        <img src={src} alt="Preview do banner" className="relative w-full h-full object-contain" />
      </>
    ) : (
      <div className="absolute inset-0 grid place-items-center text-xs text-white/50">
        Envie a arte para visualizar
      </div>
    )}
  </div>
);

export const EventBannerConfig = ({
  aspect,
  bannerImage,
  mobileImage,
  onChange,
  onUploadBanner,
  onUploadMobile,
}: Props) => {
  const value = normalizeBannerAspect(aspect);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const opt = BANNER_ASPECT_OPTIONS.find((o) => o.value === value)!;

  return (
    <div className="space-y-5">
      {/* Formato */}
      <div>
        <p className="text-sm font-medium">Formato no celular</p>
        <p className="text-sm text-muted-foreground mt-1">
          Este formato vale apenas para a exibição no celular. No desktop o banner é sempre exibido em
          formato horizontal (16:9), usando a arte principal.
        </p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BANNER_ASPECT_OPTIONS.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ banner_aspect_ratio: o.value })}
                className={cn(
                  "relative rounded-xl border p-3 text-left transition-all",
                  active ? "border-brand ring-2 ring-brand/30 bg-brand/5" : "border-border hover:border-brand/50"
                )}
              >
                {o.recommended && (
                  <span className="absolute -top-2 right-2 text-[9px] font-semibold uppercase tracking-wider bg-brand text-brand-foreground rounded-full px-2 py-0.5">
                    Recomendado
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span
                    className={cn("block w-6 rounded-sm border", active ? "border-brand bg-brand/30" : "border-muted-foreground/40")}
                    style={bannerRatioStyle(o.value)}
                  />
                  <span className="text-sm font-semibold">{o.label}</span>
                </div>
                <span className="mt-1 block text-xs text-muted-foreground">{o.hint}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-sm bg-muted/40 border border-border rounded-lg p-3 space-y-1">
          <p><strong>📐 Recomendado:</strong> {opt.size}</p>
          {value === "9:16" && <p>Ideal para artes com patrocinadores e informações completas da prova.</p>}
          <p><strong>📦 Formato:</strong> JPG ou PNG, até 3 MB.</p>
        </div>
      </div>

      {/* Arte principal */}
      <div>
        <p className="text-sm font-medium mb-2">Arte do banner</p>
        <div className="flex gap-2">
          <Input
            placeholder="URL da imagem do banner"
            value={bannerImage || ""}
            onChange={(e) => onChange({ banner_image: e.target.value })}
          />
          <label className="cursor-pointer">
            <Button type="button" variant="outline" size="sm" asChild>
              <span><Upload className="w-4 h-4" /> Enviar</span>
            </Button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadBanner(f); }}
            />
          </label>
        </div>
      </div>

      {/* Arte mobile opcional */}
      <div>
        <p className="text-sm font-medium">Arte específica para celular (opcional)</p>
        <p className="text-xs text-muted-foreground mb-2">
          Se enviar, essa arte vertical será usada no celular. Sem ela, usamos a arte principal.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="URL da arte mobile (opcional)"
            value={mobileImage || ""}
            onChange={(e) => onChange({ banner_mobile_image: e.target.value })}
          />
          <label className="cursor-pointer">
            <Button type="button" variant="outline" size="sm" asChild>
              <span><Upload className="w-4 h-4" /> Enviar</span>
            </Button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadMobile(f); }}
            />
          </label>
          {mobileImage && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ banner_mobile_image: "" })}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Preview */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-medium mr-2">Pré-visualização</p>
          <div className="inline-flex rounded-lg border border-border p-1 bg-background">
            {(["mobile", "desktop"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md transition-colors inline-flex items-center gap-1.5",
                  device === d ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d === "mobile" ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                {d === "mobile" ? "Mobile" : "Desktop"}
              </button>
            ))}
          </div>
        </div>
        <Preview
          device={device}
          aspect={value}
          src={device === "mobile" ? mobileImage || bannerImage : bannerImage}
        />
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {device === "mobile"
            ? "No celular usamos a arte específica (se existir) no formato escolhido acima."
            : "No desktop usamos sempre a arte principal em formato horizontal (16:9)."}{" "}
          A arte aparece por inteiro (sem cortar patrocinadores), com fundo desfocado nas sobras.
        </p>
      </div>
    </div>
  );
};
