import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/update-hero")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: rows, error: selectError } = await supabaseAdmin
          .from("site_settings")
          .select("id")
          .limit(1);

        if (selectError || !rows || rows.length === 0) {
          return new Response(
            JSON.stringify({ error: selectError?.message ?? "No site_settings row found" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        const { error } = await supabaseAdmin
          .from("site_settings")
          .update({ hero_title: "Você não treina sozinho. Tem um time com você." })
          .eq("id", rows[0].id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
