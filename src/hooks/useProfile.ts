import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  cpf: string;
  birth_date: string | null;
  gender: string;
  phone: string;
  whatsapp: string;
  email: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  team_name: string;
  accepts_marketing: boolean;
  accepted_terms_at: string | null;
};

export const useProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile) ?? null;
    },
  });
};

export type EventSignup = {
  id: string;
  user_id: string;
  event_id: string;
  category: string;
  status: string;
  notes: string;
  created_at: string;
  kit_option?: string | null;
  shirt_size?: string | null;
  team_name?: string | null;
  coupon_code?: string | null;
  participant_full_name?: string | null;
  participant_cpf?: string | null;
  participant_birth_date?: string | null;
  participant_gender?: string | null;
  participant_phone?: string | null;
  events?: {
    id: string;
    name: string;
    date: string;
    city: string;
    distance: string;
    status: string;
    start_time?: string | null;
    kit_delivery?: string | null;
    kit_info?: string | null;
  } | null;
};

export const useMySignups = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my_signups", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<EventSignup[]> => {
      const { data, error } = await supabase
        .from("event_signups")
        .select(
          "*, events(id, name, date, city, distance, status, start_time, kit_delivery, kit_info)"
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EventSignup[];
    },
  });
};
