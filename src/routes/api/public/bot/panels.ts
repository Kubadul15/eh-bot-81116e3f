import { createFileRoute } from "@tanstack/react-router";
import { PANEL_KEYS, isSnowflake } from "@/lib/bot-slots";

// Called by the bot process after it sent a panel. Auth: Authorization: Bearer <BOT_API_KEY>
export const Route = createFileRoute("/api/public/bot/panels")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["BOT_API_KEY"];
        const auth = request.headers.get("authorization") ?? "";
        if (!key || auth !== `Bearer ${key}`) return new Response("Unauthorized", { status: 401 });
        let body: { guild?: string; panel?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad body", { status: 400 });
        }
        if (!isSnowflake(body.guild) || !PANEL_KEYS.includes(body.panel as (typeof PANEL_KEYS)[number]))
          return new Response("Bad request", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfg } = await supabaseAdmin.from("guild_configs").select("panels").eq("guild_id", body.guild).maybeSingle();
        const panels = { ...((cfg?.panels as Record<string, string> | null) ?? {}) };
        delete panels[body.panel];
        await supabaseAdmin.from("guild_configs").update({ panels }).eq("guild_id", body.guild);
        return Response.json({ ok: true });
      },
    },
  },
});
