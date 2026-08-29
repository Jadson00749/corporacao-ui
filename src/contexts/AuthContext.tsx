import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "organizer" | "user";

type AuthState = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isOrganizer: boolean;
  role: AppRole;
  organizerId: string | null;
  roleLoading: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  isAdmin: false,
  isOrganizer: false,
  role: "user",
  organizerId: null,
  roleLoading: true,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<AppRole>("user");
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Set up listener BEFORE getSession (per Supabase guidance)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer Supabase calls (avoid deadlock with the listener)
        setTimeout(() => {
          checkAdmin(newSession.user.id);
        }, 0);
      } else {
        setIsAdmin(false);
        setRole("user");
        setOrganizerId(null);
        setRoleLoading(false);
      }
    });

    // 2. Then get the existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        checkAdmin(existing.user.id);
      } else {
        setRoleLoading(false);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const checkAdmin = async (userId: string) => {
    setRoleLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (data ?? []).map((r: any) => r.role);
    const admin = roles.includes("admin");
    setIsAdmin(admin);

    if (admin) {
      setRole("admin");
      setOrganizerId(null);
      setRoleLoading(false);
      return;
    }

    // Organizer: confirmado pelo papel OU por um vínculo ativo em organizers
    const { data: org } = await supabase
      .from("organizers" as any)
      .select("id,status")
      .eq("user_id", userId)
      .maybeSingle();
    const activeOrg = org && ((org as any).status ?? "active") === "active" ? (org as any) : null;

    if (roles.includes("organizer") || activeOrg) {
      setRole("organizer");
      setOrganizerId(activeOrg?.id ?? null);
    } else {
      setRole("user");
      setOrganizerId(null);
    }
    setRoleLoading(false);
  };


  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setRole("user");
    setOrganizerId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        isOrganizer: role === "organizer",
        role,
        organizerId,
        roleLoading,
        loading,
        signOut,
      }}
    >

      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
