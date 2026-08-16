import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const supabaseAdmin = createClient<Database>(
  process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
