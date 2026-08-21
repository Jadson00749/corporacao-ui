import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, ImageIcon } from "lucide-react";

const FIELDS: Array<{ key: string; label: string; multiline?: boolean }> = [
  { key: "brand_name", label: "Nome da marca" },
  { key: "brand_short", label: "Marca curta" },
  { key: "brand_slogan", label: "Slogan" },
  { key: "brand_description", label: "Descrição da marca", multiline: true },
  { key: "contact_whatsapp", label: "WhatsApp (só números, c/ DDI)" },
  { key: "contact_whatsapp_display", label: "WhatsApp formatado" },
  { key: "contact_email", label: "E-mail" },
  { key: "contact_instagram", label: "Instagram (URL completa)" },
  { key: "contact_instagram_handle", label: "Instagram (@)" },
  { key: "contact_strava", label: "Strava (URL)" },
  { key: "contact_region", label: "Região atendida" },
  { key: "hero_eyebrow", label: "Hero: Eyebrow (texto pequeno acima do título)" },
  { key: "hero_title", label: "Hero: Título principal" },
  { key: "hero_title_accent", label: "Hero: Linha de destaque (abaixo do título)" },
  { key: "hero_subtitle", label: "Hero: Parágrafo descritivo", multiline: true },
  { key: "hero_primary_cta", label: "Hero: Texto do botão principal (WhatsApp)" },
  { key: "hero_secondary_cta", label: "Hero: Texto do link secundário (Planos)" },
  { key: "hero_stat_1_value", label: "Hero: Estatística 1 — número (ex: 500+)" },
  { key: "hero_stat_1_label", label: "Hero: Estatística 1 — legenda" },
  { key: "hero_stat_2_value", label: "Hero: Estatística 2 — número" },
  { key: "hero_stat_2_label", label: "Hero: Estatística 2 — legenda" },
  { key: "hero_stat_3_value", label: "Hero: Estatística 3 — número" },
  { key: "hero_stat_3_label", label: "Hero: Estatística 3 — legenda" },
  { key: "cta_final_title", label: "CTA final: Título" },
  { key: "cta_final_subtitle", label: "CTA final: Subtítulo", multiline: true },
  { key: "cta_final_button", label: "CTA final: Botão" },
  { key: "product_pix_key", label: "Produtos: Chave PIX" },
  { key: "product_pix_recipient", label: "Produtos: Nome do recebedor PIX" },
  { key: "product_payment_instructions", label: "Produtos: Instruções de pagamento", multiline: true },
];

// Fotos editáveis dos cards de benefícios da home.
// A ordem aqui corresponde à ordem que aparece no site.
const HOME_BENEFIT_IMAGES: Array<{ key: string; cardNumber: string; cardTitle: string }> = [
  { key: "home_benefit_image_1", cardNumber: "01", cardTitle: "Treinão mensal da equipe" },
  { key: "home_benefit_image_2", cardNumber: "02", cardTitle: "Planilha individualizada" },
  { key: "home_benefit_image_3", cardNumber: "03", cardTitle: "Acompanhamento contínuo" },
  { key: "home_benefit_image_4", cardNumber: "04", cardTitle: "Equipe presente nas provas" },
  { key: "home_benefit_image_5", cardNumber: "05", cardTitle: "Clube de benefícios" },
  { key: "home_benefit_image_6", cardNumber: "06", cardTitle: "Comunidade de verdade" },
];

// Todas as outras fotos editáveis do site, agrupadas por página.
type PageImage = { key: string; label: string; hint?: string };
type ImageGroup = { groupTitle: string; groupHint: string; images: PageImage[] };

const PAGE_IMAGE_GROUPS: ImageGroup[] = [
  {
    groupTitle: "Home — Seção 'Quem somos'",
    groupHint: "Fotos exibidas no bloco editorial logo após os destaques da home.",
    images: [
      { key: "home_intro_image", label: "Foto principal (vertical, 4:5)", hint: "Recomendado 1200 × 1500 px" },
      { key: "home_team_avatar_1", label: "Avatar 1 (círculo, equipe)", hint: "Quadrada, 400 × 400 px" },
      { key: "home_team_avatar_2", label: "Avatar 2 (círculo, equipe)", hint: "Quadrada, 400 × 400 px" },
      { key: "home_team_avatar_3", label: "Avatar 3 (círculo, equipe)", hint: "Quadrada, 400 × 400 px" },
      { key: "home_team_avatar_4", label: "Avatar 4 (círculo, equipe)", hint: "Quadrada, 400 × 400 px" },
    ],
  },
  {
    groupTitle: "Página Sobre / Quem Somos",
    groupHint: "Imagens da página de apresentação dos coaches e comunidade.",
    images: [
      { key: "sobre_coach_1_image", label: "Foto do Coach 1 (Lucas)", hint: "Vertical 3:4, 600 × 800 px" },
      { key: "sobre_coach_2_image", label: "Foto do Coach 2 (Helô)", hint: "Vertical 3:4, 600 × 800 px" },
      { key: "sobre_main_image", label: "Foto principal 'Juntos somos'", hint: "Vertical 4:5, 1000 × 1250 px" },
      { key: "sobre_gallery_1", label: "Mosaico 1 — vertical alta esquerda", hint: "Vertical 2:3" },
      { key: "sobre_gallery_2", label: "Mosaico 2 — vertical alta direita", hint: "Vertical 2:3" },
      { key: "sobre_gallery_3", label: "Mosaico 3 — horizontal inferior", hint: "Horizontal 3:2" },
      { key: "sobre_races_image", label: "Foto grande 'Em equipe nas provas'", hint: "Horizontal 4:3, 1200 × 900 px" },
    ],
  },
  {
    groupTitle: "Página Contato",
    groupHint: "Foto humana exibida ao lado do formulário de contato.",
    images: [
      { key: "contato_image", label: "Foto da equipe (vertical 3:4)", hint: "Recomendado 900 × 1200 px" },
    ],
  },
  {
    groupTitle: "Modal de boas-vindas",
    groupHint: "Aparece para o atleta na primeira entrada após login.",
    images: [
      { key: "welcome_image", label: "Foto dos fundadores (horizontal 4:3)", hint: "1200 × 900 px" },
    ],
  },
  {
    groupTitle: "Home — Seção 'Escolha seu caminho'",
    groupHint: "Cards verticais exibidos como caminhos (corrida, fortalecimento, completo).",
    images: [
      { key: "pathway_1_image", label: "Caminho 01 — Quero correr", hint: "Vertical 4:5, 1000 × 1250 px" },
      { key: "pathway_2_image", label: "Caminho 02 — Fortalecimento", hint: "Vertical 4:5, 1000 × 1250 px" },
      { key: "pathway_3_image", label: "Caminho 03 — Pacote completo", hint: "Vertical 4:5, 1000 × 1250 px" },
    ],
  },
  {
    groupTitle: "Home — Seção TrainingPeaks",
    groupHint: "Bloco escuro 'Tecnologia + método' da home.",
    images: [
      { key: "trainingpeaks_hero_image", label: "Foto de fundo (cinematográfica)", hint: "Horizontal, 1920 × 1080 px" },
      { key: "trainingpeaks_app_image", label: "Mockup do app (PNG transparente)", hint: "PNG sem fundo, 800 × 1200 px" },
    ],
  },
];

const AdminSettings = () => {
  const qc = useQueryClient();
  const [row, setRow] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("site_settings").select("*").limit(1).maybeSingle().then(({ data }) => setRow(data));
  }, []);

  if (!row) return <div className="text-muted-foreground">Carregando...</div>;

  const update = (k: string, v: string) => setRow({ ...row, [k]: v });

  const uploadImage = async (key: string, file: File, folder = "home-benefits") => {
    setUploading(key);
    const path = `${folder}/${key}-${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error } = await supabase.storage.from("corporacao-bucket").upload(path, file);
    if (error) {
      setUploading(null);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from("corporacao-bucket").getPublicUrl(path);
    update(key, data.publicUrl);
    setUploading(null);
    toast.success("Imagem enviada! Lembre de salvar.");
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("site_settings").update(row).eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas!");
    qc.invalidateQueries({ queryKey: ["site_settings"] });
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Configurações do site</h1>
      <p className="text-muted-foreground mt-1">Marca, contato, hero e CTAs.</p>

      <div className="mt-8 space-y-4 bg-card border border-border rounded-xl p-6">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            {f.multiline ? (
              <Textarea value={row[f.key] ?? ""} onChange={(e) => update(f.key, e.target.value)} rows={3} className="mt-1" />
            ) : (
              <Input value={row[f.key] ?? ""} onChange={(e) => update(f.key, e.target.value)} className="mt-1" />
            )}
          </div>
        ))}
      </div>

      {/* IMAGEM DE FUNDO DO HERO */}
      <div className="mt-8 bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-3">
          <ImageIcon className="w-5 h-5 mt-0.5 text-brand" />
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold">Imagem de fundo do Hero (Home)</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Foto principal exibida atrás do título na primeira dobra da home.
            </p>
            <div className="mt-3 text-sm bg-muted/40 border border-border rounded-lg p-3 space-y-1">
              <p><strong>📐 Tamanho recomendado:</strong> 1920 × 1280 px (horizontal)</p>
              <p><strong>📦 Formato:</strong> JPG, até 3 MB</p>
              <p><strong>🎯 Dica:</strong> foto com profundidade e movimento, assunto principal levemente à direita.</p>
            </div>

            {row.hero_image && (
              <div className="mt-4 aspect-[16/9] rounded-md overflow-hidden border border-border bg-muted max-w-xl">
                <img src={row.hero_image} alt="Hero atual" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="mt-4 max-w-xl">
              <Label className="text-xs">URL da imagem</Label>
              <Input
                value={row.hero_image ?? ""}
                onChange={(e) => update("hero_image", e.target.value)}
                placeholder="https://... ou faça upload abaixo"
                className="mt-1"
              />
            </div>

            <label className="mt-3 inline-flex items-center gap-2 cursor-pointer text-xs font-semibold px-3 py-2 rounded-md border border-border hover:border-brand/60 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              {uploading === "hero_image" ? "Enviando..." : "Fazer upload"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage("hero_image", f, "hero");
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* PROPORÇÃO PADRÃO DOS BANNERS DE TREINO */}
      <div className="mt-8 bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-3">
          <ImageIcon className="w-5 h-5 mt-0.5 text-brand" />
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold">Proporção padrão dos banners de treino</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Define o formato da foto exibida no topo dos cards de treino. Vale para todos os treinos.
            </p>
            <div className="mt-3 text-sm bg-muted/40 border border-border rounded-lg p-3 space-y-1">
              <p><strong>📐 Recomendado:</strong> 9:16 (vertical, estilo story, ex: 1080 × 1920 px).</p>
              <p><strong>📦 Formato:</strong> JPG ou PNG, até 3 MB.</p>
              <p><strong>🎯 Dica:</strong> use fotos verticais para sensação premium estilo Nike Run Club.</p>
            </div>

            <div className="mt-4 max-w-md">
              <Label className="text-xs">Proporção</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { v: "9/16", l: "9:16 (vertical, padrão)" },
                  { v: "3/4", l: "3:4 (vertical suave)" },
                  { v: "1/1", l: "1:1 (quadrado)" },
                  { v: "16/10", l: "16:10 (horizontal)" },
                ].map((opt) => {
                  const selected = (row.training_banner_aspect ?? "9/16") === opt.v;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => update("training_banner_aspect", opt.v)}
                      className={
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors " +
                        (selected
                          ? "bg-brand text-brand-foreground border-brand"
                          : "bg-background text-foreground/70 border-border hover:border-brand/60")
                      }
                    >
                      {opt.l}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* FOTOS DOS CARDS DE BENEFÍCIOS DA HOME */}
      <div className="mt-8 bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-3">
          <ImageIcon className="w-5 h-5 mt-0.5 text-brand" />
          <div>
            <h2 className="font-display text-xl font-semibold">Fotos dos cards de benefícios (Home)</h2>
            <p className="text-sm text-muted-foreground mt-1">
              São os 6 cards que aparecem na seção <strong>"Por que Corporação"</strong> na página inicial.
            </p>
            <div className="mt-3 text-sm bg-muted/40 border border-border rounded-lg p-3 space-y-1">
              <p><strong>📐 Tamanho recomendado:</strong> 1200 × 900 px (proporção 4:3, horizontal)</p>
              <p><strong>📦 Formato:</strong> JPG ou PNG, até 2 MB</p>
              <p><strong>🎯 Dica:</strong> use fotos com o assunto principal centralizado, sem texto sobreposto.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {HOME_BENEFIT_IMAGES.map((b) => {
            const value = row[b.key] ?? "";
            return (
              <div key={b.key} className="border border-border rounded-lg p-4 bg-background/40">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold tracking-[0.3em] uppercase text-brand">
                    Card {b.cardNumber}
                  </span>
                </div>
                <p className="font-display font-semibold text-base leading-tight">{b.cardTitle}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Foto que aparece neste card na home.
                </p>

                {value && (
                  <div className="mt-3 aspect-[4/3] rounded-md overflow-hidden border border-border bg-muted">
                    <img src={value} alt={b.cardTitle} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="mt-3">
                  <Label className="text-xs">URL da imagem</Label>
                  <Input
                    value={value}
                    onChange={(e) => update(b.key, e.target.value)}
                    placeholder="https://... ou faça upload abaixo"
                    className="mt-1"
                  />
                </div>

                <label className="mt-3 inline-flex items-center gap-2 cursor-pointer text-xs font-semibold px-3 py-2 rounded-md border border-border hover:border-brand/60 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {uploading === b.key ? "Enviando..." : "Fazer upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(b.key, f);
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* OUTRAS FOTOS DO SITE (por página) */}
      {PAGE_IMAGE_GROUPS.map((group) => (
        <div key={group.groupTitle} className="mt-8 bg-card border border-border rounded-xl p-6">
          <div className="flex items-start gap-3">
            <ImageIcon className="w-5 h-5 mt-0.5 text-brand" />
            <div>
              <h2 className="font-display text-xl font-semibold">{group.groupTitle}</h2>
              <p className="text-sm text-muted-foreground mt-1">{group.groupHint}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {group.images.map((img) => {
              const value = row[img.key] ?? "";
              return (
                <div key={img.key} className="border border-border rounded-lg p-4 bg-background/40">
                  <p className="font-display font-semibold text-sm leading-tight">{img.label}</p>
                  {img.hint && (
                    <p className="text-xs text-muted-foreground mt-0.5">{img.hint}</p>
                  )}

                  {value && (
                    <div className="mt-3 aspect-[4/3] rounded-md overflow-hidden border border-border bg-muted">
                      <img src={value} alt={img.label} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="mt-3">
                    <Label className="text-xs">URL da imagem</Label>
                    <Input
                      value={value}
                      onChange={(e) => update(img.key, e.target.value)}
                      placeholder="https://... ou faça upload abaixo"
                      className="mt-1"
                    />
                  </div>

                  <label className="mt-3 inline-flex items-center gap-2 cursor-pointer text-xs font-semibold px-3 py-2 rounded-md border border-border hover:border-brand/60 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    {uploading === img.key ? "Enviando..." : "Fazer upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(img.key, f, "site-images");
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ))}


      <div className="mt-6 flex justify-end sticky bottom-4">
        <Button onClick={save} variant="brand" size="lg" disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
};

export default AdminSettings;
