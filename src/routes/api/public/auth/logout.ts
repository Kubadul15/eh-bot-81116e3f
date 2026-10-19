import { createFileRoute } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";

export const Route = createFileRoute("/api/public/auth/logout")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = getCookie("ehb_session");
        if (id && /^[0-9a-f-]{36}$/.test(id)) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("dash_sessions").delete().eq("id", id);
        }
        deleteCookie("ehb_session", { path: "/" });
        return Response.redirect(new URL("/", request.url).toString(), 302);
      },
    },
  },
});
