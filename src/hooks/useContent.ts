// React Query hooks that load editable content from Lovable Cloud.
// Components keep using the same shapes defined in src/data/* types.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/data/plans";
import type { Training } from "@/data/trainings";
import type { RaceEvent, EventStatus } from "@/data/events";
import type { Product } from "@/data/products";
import type { GalleryItem } from "@/data/gallery";
import type { Testimonial } from "@/data/testimonials";
import type { PhotoEvent, PhotoEventStatus } from "@/data/photoEvents";
import { siteSettings as fallbackSettings } from "@/data/settings";

const orFallback = (v: string | null | undefined, fb: string) =>
  v && v.trim().length > 0 ? v : fb;

export type SiteSettings = {
  brand: { name: string; short: string; slogan: string; description: string };
  contact: {
    whatsapp: string;
    whatsappDisplay: string;
    email: string;
    instagram: string;
    instagramHandle: string;
    strava: string;
    region: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    image: string;
    stats: Array<{ value: string; label: string }>;
  };
  cta: { finalTitle: string; finalSubtitle: string; finalButton: string };
  productPayment: { pixKey: string; pixRecipient: string; instructions: string };
  homeBenefitImages: string[];
  images: {
    homeIntro: string;
    homeTeamAvatars: string[];
    sobreCoach1: string;
    sobreCoach2: string;
    sobreMain: string;
    sobreGallery: string[];
    sobreRaces: string;
    contato: string;
    welcome: string;
    pathways: string[];
    trainingPeaksHero: string;
    trainingPeaksApp: string;
  };
  trainings: { bannerAspect: string };
};

export const whatsappLink = (whatsapp: string, message?: string) => {
  const base = `https://wa.me/${whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};

export const useSiteSettings = () =>
  useQuery({
    queryKey: ["site_settings"],
    queryFn: async (): Promise<SiteSettings> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const r = data!;
      const fb = fallbackSettings;
      return {
        brand: {
          name: orFallback(r.brand_name, fb.brand.name),
          short: orFallback(r.brand_short, fb.brand.short),
          slogan: orFallback(r.brand_slogan, fb.brand.slogan),
          description: orFallback(r.brand_description, fb.brand.description),
        },
        contact: {
          whatsapp: orFallback(r.contact_whatsapp, fb.contact.whatsapp),
          whatsappDisplay: orFallback(r.contact_whatsapp_display, fb.contact.whatsappDisplay),
          email: orFallback(r.contact_email, fb.contact.email),
          instagram: orFallback(r.contact_instagram, fb.contact.instagram),
          instagramHandle: orFallback(r.contact_instagram_handle, fb.contact.instagramHandle),
          strava: orFallback(r.contact_strava, fb.contact.strava),
          region: orFallback(r.contact_region, fb.contact.region),
        },
        hero: {
          eyebrow: orFallback(r.hero_eyebrow, fb.hero.eyebrow),
          title: orFallback(r.hero_title, fb.hero.title),
          titleAccent: orFallback(r.hero_title_accent, fb.hero.titleAccent),
          subtitle: orFallback(r.hero_subtitle, fb.hero.subtitle),
          primaryCta: orFallback(r.hero_primary_cta, fb.hero.primaryCta),
          secondaryCta: orFallback(r.hero_secondary_cta, fb.hero.secondaryCta),
          image: orFallback((r as any).hero_image, fb.hero.image),
          stats: [
            { value: orFallback((r as any).hero_stat_1_value, fb.hero.stats[0].value), label: orFallback((r as any).hero_stat_1_label, fb.hero.stats[0].label) },
            { value: orFallback((r as any).hero_stat_2_value, fb.hero.stats[1].value), label: orFallback((r as any).hero_stat_2_label, fb.hero.stats[1].label) },
            { value: orFallback((r as any).hero_stat_3_value, fb.hero.stats[2].value), label: orFallback((r as any).hero_stat_3_label, fb.hero.stats[2].label) },
          ],
        },
        cta: {
          finalTitle: orFallback(r.cta_final_title, fb.cta.finalTitle),
          finalSubtitle: orFallback(r.cta_final_subtitle, fb.cta.finalSubtitle),
          finalButton: orFallback(r.cta_final_button, fb.cta.finalButton),
        },
        productPayment: {
          pixKey: (r as any).product_pix_key ?? "",
          pixRecipient: (r as any).product_pix_recipient ?? "",
          instructions: (r as any).product_payment_instructions ?? "",
        },
        homeBenefitImages: [
          (r as any).home_benefit_image_1 ?? "",
          (r as any).home_benefit_image_2 ?? "",
          (r as any).home_benefit_image_3 ?? "",
          (r as any).home_benefit_image_4 ?? "",
          (r as any).home_benefit_image_5 ?? "",
          (r as any).home_benefit_image_6 ?? "",
        ],
        images: {
          homeIntro: (r as any).home_intro_image ?? "",
          homeTeamAvatars: [
            (r as any).home_team_avatar_1 ?? "",
            (r as any).home_team_avatar_2 ?? "",
            (r as any).home_team_avatar_3 ?? "",
            (r as any).home_team_avatar_4 ?? "",
          ],
          sobreCoach1: (r as any).sobre_coach_1_image ?? "",
          sobreCoach2: (r as any).sobre_coach_2_image ?? "",
          sobreMain: (r as any).sobre_main_image ?? "",
          sobreGallery: [
            (r as any).sobre_gallery_1 ?? "",
            (r as any).sobre_gallery_2 ?? "",
            (r as any).sobre_gallery_3 ?? "",
          ],
          sobreRaces: (r as any).sobre_races_image ?? "",
          contato: (r as any).contato_image ?? "",
          welcome: (r as any).welcome_image ?? "",
          pathways: [
            (r as any).pathway_1_image ?? "",
            (r as any).pathway_2_image ?? "",
            (r as any).pathway_3_image ?? "",
          ],
          trainingPeaksHero: (r as any).trainingpeaks_hero_image ?? "",
          trainingPeaksApp: (r as any).trainingpeaks_app_image ?? "",
        },
        trainings: {
          bannerAspect: orFallback((r as any).training_banner_aspect, fb.trainings.bannerAspect),
        },
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const usePlans = () =>
  useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        tagline: r.tagline,
        price: r.price ?? undefined,
        priceNote: r.price_note ?? undefined,
        priceInstallments: (r as any).price_installments ?? undefined,
        footerNote: (r as any).footer_note ?? undefined,
        highlight: r.highlight,
        features: r.features ?? [],
        ctaMessage: r.cta_message,
        categories: ((r as any).categories ?? []) as Plan["categories"],
      }));
    },
  });

export const useTrainings = () =>
  useQuery({
    queryKey: ["trainings"],
    queryFn: async (): Promise<Training[]> => {
      const { data, error } = await supabase
        .from("trainings")
        .select("*")
        .eq("active", true)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        time: r.time,
        location: r.location,
        mapUrl: r.map_url ?? undefined,
        description: r.description,
        level: r.level as Training["level"],
        capacity: (r as any).capacity ?? null,
        image: (r as any).image ?? undefined,
      }));
    },
  });

export const useEvents = () =>
  useQuery({
    queryKey: ["events"],
    queryFn: async (): Promise<RaceEvent[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("active", true)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        date: r.date,
        city: r.city,
        distance: r.distance,
        description: r.description,
        registrationUrl: r.registration_url,
        status: r.status as EventStatus,
        image: r.image ?? undefined,
        bannerImage: r.banner_image ?? undefined,
        bannerMobileImage: r.banner_mobile_image ?? undefined,
        bannerAspectRatio: r.banner_aspect_ratio ?? "9:16",
        internalSignup: r.internal_signup ?? false,
        regulationUrl: r.regulation_url ?? "",
        kitInfo: r.kit_info ?? "",
        kitDelivery: r.kit_delivery ?? "",
        moreInfo: r.more_info ?? "",
        eventTerms: r.event_terms ?? "",
        registrationDeadline: r.registration_deadline ?? null,
        distances: (r.distances ?? []) as RaceEvent["distances"],
        genders: (r.genders ?? []) as string[],
        ageBrackets: (r.age_brackets ?? []) as RaceEvent["ageBrackets"],
        kitOptions: (r.kit_options ?? []) as RaceEvent["kitOptions"],
        coupons: (r.coupons ?? []) as RaceEvent["coupons"],
      }));
    },
  });

export const useProducts = () =>
  useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        image: r.image,
        images: ((r as any).images ?? []) as string[],
        price: r.price ?? undefined,
        description: r.description,
        ctaMessage: r.cta_message,
      }));
    },
  });

export const useGallery = () =>
  useQuery({
    queryKey: ["gallery"],
    queryFn: async (): Promise<GalleryItem[]> => {
      const { data, error } = await supabase
        .from("gallery")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        src: r.src,
        title: r.title,
        category: r.category as GalleryItem["category"],
      }));
    },
  });

export const useTestimonials = () =>
  useQuery({
    queryKey: ["testimonials"],
    queryFn: async (): Promise<Testimonial[]> => {
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        role: r.role,
        text: r.text,
        avatar: r.avatar ?? null,
      }));
    },
  });

export type FAQ = { id: string; q: string; a: string };

export const useFaqs = () =>
  useQuery({
    queryKey: ["faqs"],
    queryFn: async (): Promise<FAQ[]> => {
      const { data, error } = await supabase
        .from("faqs")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, q: r.question, a: r.answer }));
    },
  });

export const usePhotoEvents = () =>
  useQuery({
    queryKey: ["photo_events"],
    queryFn: async (): Promise<PhotoEvent[]> => {
      const { data, error } = await supabase
        .from("photo_events")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        location: r.location,
        coverImage: r.cover_image ?? "",
        description: r.description,
        photoLink: r.photo_link,
        status: (r.status as PhotoEventStatus) ?? "Em breve",
      }));
    },
  });
