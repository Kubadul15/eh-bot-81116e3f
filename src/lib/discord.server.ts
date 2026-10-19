import { getCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const API = "https://discord.com/api/v10";
export const COOKIE = "ehb_session";

export async function getSession() {
  const id = getCookie(COOKIE);
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await supabaseAdmin
    .from("dash_sessions")
    .select("*")
    .eq("id", id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data;
}

export type DGuild = { id: string; name: string; icon: string | null; owner: boolean; permissions: string };

export async function userGuilds(token: string): Promise<DGuild[]> {
  const r = await fetch(`${API}/users/@me/guilds`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Discord ${r.status}`);
  return r.json();
}

// MANAGE_GUILD (0x20) or ADMINISTRATOR (0x8)
export const canManage = (g: DGuild) => g.owner || (BigInt(g.permissions) & 0x28n) !== 0n;

export const bot = (path: string) =>
  fetch(`${API}${path}`, { headers: { authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } });

export async function requireGuild(guildId: string) {
  const s = await getSession();
  if (!s) throw new Error("Nie jesteś zalogowany");
  const g = (await userGuilds(s.access_token)).find((x) => x.id === guildId && canManage(x));
  if (!g) throw new Error("Brak uprawnień do tego serwera");
  return { s, g };
}
