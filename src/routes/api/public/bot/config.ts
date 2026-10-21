import { createFileRoute } from "@tanstack/react-router";

// Called by the bot process. Auth: Authorization: Bearer <BOT_API_KEY>
export const Route = createFileRoute("/api/public/bot/config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env["BOT_API_KEY"];
        const auth = request.headers.get("authorization") ?? "";
        if (!key || auth !== `Bearer ${key}`) return new Response("Unauthorized", { status: 401 });
        const guild = new URL(request.url).searchParams.get("guild") ?? "";
        if (!/^\d{17,20}$/.test(guild)) return new Response("Bad guild", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("guild_configs")
          .select("channels, roles, settings, panels")
          .eq("guild_id", guild)
          .maybeSingle();
        return Response.json(data ?? { channels: {}, roles: {}, settings: {}, panels: {} });
      },
    },
  },
});
