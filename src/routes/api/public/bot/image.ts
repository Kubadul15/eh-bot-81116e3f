import { createFileRoute } from "@tanstack/react-router";

// Public display of intentionally shared bot images; uploads require Discord guild management.
export const Route = createFileRoute("/api/public/bot/image")({ server: { handlers: {
  GET: async ({ request }) => {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage.from("bot-images").download(id);
    if (error || !data) return new Response("Not found", { status: 404 });
    return new Response(data, { headers: { "Content-Type": data.type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
  },
} } });