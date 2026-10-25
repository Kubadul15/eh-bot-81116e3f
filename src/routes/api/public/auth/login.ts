import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";

export const Route = createFileRoute("/api/public/auth/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env["DISCORD_CLIENT_ID"];
        if (!clientId) return new Response("Brak DISCORD_CLIENT_ID", { status: 500 });
        const origin = new URL(request.url).origin;
        const state = crypto.randomUUID();
        setCookie("ehb_state", state, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 600,
        });
        // po zalogowaniu wracamy tam, skąd użytkownik przyszedł (tylko własne ścieżki: panel serwera albo panel rekrutacji)
        const next = new URL(request.url).searchParams.get("next") ?? "";
        if (/^\/(dashboard(\/\d{17,20})?|rekrutacja\/\d{17,20}\/panel)$/.test(next))
          setCookie("ehb_next", next, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 600,
          });
        const u = new URL("https://discord.com/oauth2/authorize");
        u.searchParams.set("client_id", clientId);
        u.searchParams.set("response_type", "code");
        u.searchParams.set("scope", "identify guilds");
        u.searchParams.set("redirect_uri", `${origin}/api/public/auth/callback`);
        u.searchParams.set("state", state);
        return new Response(null, { status: 302, headers: { location: u.toString() } });
      },
    },
  },
});
