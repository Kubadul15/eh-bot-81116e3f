import { createFileRoute } from "@tanstack/react-router";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

export const Route = createFileRoute("/api/public/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const expected = getCookie("ehb_state");
        deleteCookie("ehb_state", { path: "/" });
        if (!code || !state || state !== expected) return new Response("Błędne logowanie, spróbuj ponownie.", { status: 400 });

        const tr = await fetch("https://discord.com/api/v10/oauth2/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env["DISCORD_CLIENT_ID"]!,
            client_secret: process.env["DISCORD_CLIENT_SECRET"]!,
            grant_type: "authorization_code",
            code,
            redirect_uri: `${url.origin}/api/public/auth/callback`,
          }),
        });
        if (!tr.ok) return new Response("Discord odrzucił logowanie.", { status: 400 });
        const tok = (await tr.json()) as { access_token: string; expires_in: number };
        const ur = await fetch("https://discord.com/api/v10/users/@me", {
          headers: { authorization: `Bearer ${tok.access_token}` },
        });
        if (!ur.ok) return new Response("Nie udało się pobrać konta.", { status: 400 });
        const me = (await ur.json()) as { id: string; username: string; global_name?: string; avatar: string | null };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("dash_sessions")
          .insert({
            discord_user_id: me.id,
            username: me.global_name || me.username,
            avatar: me.avatar,
            access_token: tok.access_token,
            expires_at: new Date(Date.now() + Math.min(tok.expires_in, 7 * 86400) * 1000).toISOString(),
          })
          .select("id")
          .single();
        if (error) return new Response("Błąd serwera.", { status: 500 });
        setCookie("ehb_session", data.id, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
        return new Response(null, { status: 302, headers: { location: `${url.origin}/dashboard` } });
      },
    },
  },
});
