import { createFileRoute } from "@tanstack/react-router";

// Called by the bot every few seconds. Returns full configs of the given guilds that have panels waiting to be sent,
// so the bot sends them immediately (with fresh channel settings). Auth: Authorization: Bearer <BOT_API_KEY>
export const Route = createFileRoute("/api/public/bot/pending")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env["BOT_API_KEY"];
        const auth = request.headers.get("authorization") ?? "";
        if (!key || auth !== `Bearer ${key}`) return new Response("Unauthorized", { status: 401 });
        const ids = (new URL(request.url).searchParams.get("guilds") ?? "")
          .split(",")
          .filter((g) => /^\d{17,20}$/.test(g))
          .slice(0, 100);
        if (!ids.length) return Response.json([]);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("guild_configs")
          .select("guild_id, channels, roles, settings, panels, content")
          .in("guild_id", ids);
        const waiting = (data ?? []).filter(
          (c) => Object.keys((c.panels as Record<string, string> | null) ?? {}).length > 0,
        );
        return Response.json(
          waiting.map((c) => ({
            guild: c.guild_id,
            config: {
              channels: c.channels ?? {},
              roles: c.roles ?? {},
              settings: c.settings ?? {},
              panels: c.panels ?? {},
              content: c.content ?? {},
            },
          })),
        );
      },
    },
  },
});
