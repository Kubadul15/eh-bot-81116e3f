import { createServerFn } from "@tanstack/react-start";
import { CHANNEL_KEYS, ROLE_FIELDS, NUM_FIELDS, PANEL_KEYS, isSnowflake } from "./bot-slots";

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { getSession } = await import("./discord.server");
  const s = await getSession();
  return {
    clientId: process.env["DISCORD_CLIENT_ID"] ?? null,
    user: s ? { id: s.discord_user_id, username: s.username, avatar: s.avatar } : null,
  };
});

export const listGuilds = createServerFn({ method: "GET" }).handler(async () => {
  const { getSession, userGuilds, canManage, bot } = await import("./discord.server");
  const s = await getSession();
  if (!s) return null;
  const mine = (await userGuilds(s.access_token)).filter(canManage);
  const r = await bot("/users/@me/guilds?limit=200");
  let botIds: Set<string> | null = null;
  if (r.ok) botIds = new Set(((await r.json()) as { id: string }[]).map((g) => g.id));
  else console.error("bot guilds list failed", r.status);
  // Fallback: sprawdź każdy serwer osobno, gdy lista bota nie działa.
  const checks = await Promise.all(
    mine.map(async (g) => (botIds ? botIds.has(g.id) : (await bot(`/guilds/${g.id}`)).ok)),
  );
  return mine.map((g, i) => ({ id: g.id, name: g.name, icon: g.icon, botIn: checks[i] }));
});

type Ch = { id: string; name: string; type: number; position: number };
type Role = { id: string; name: string; color: number; position: number; managed: boolean };

export const getGuild = createServerFn({ method: "GET" })
  .inputValidator((d: { guildId: string }) => {
    if (!isSnowflake(d?.guildId)) throw new Error("Złe ID serwera");
    return d;
  })
  .handler(async ({ data }) => {
    const { requireGuild, bot } = await import("./discord.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { g } = await requireGuild(data.guildId);
    const [cr, rr] = await Promise.all([bot(`/guilds/${g.id}/channels`), bot(`/guilds/${g.id}/roles`)]);
    if (!cr.ok || !rr.ok) return { guild: { id: g.id, name: g.name, icon: g.icon }, botIn: false as const };
    const channels = ((await cr.json()) as Ch[])
      .filter((c) => [0, 4, 5].includes(c.type))
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, name: c.name, type: c.type }));
    const roles = ((await rr.json()) as Role[])
      .filter((r) => !r.managed && r.id !== g.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.color }));
    const { data: cfg } = await supabaseAdmin.from("guild_configs").select("*").eq("guild_id", g.id).maybeSingle();
    return {
      guild: { id: g.id, name: g.name, icon: g.icon },
      botIn: true as const,
      channels,
      roles,
      config: {
        channels: (cfg?.channels ?? {}) as Record<string, string>,
        roles: (cfg?.roles ?? {}) as Record<string, string[] | string>,
        settings: (cfg?.settings ?? {}) as Record<string, number>,
         content: cfg?.content ?? {},
      },
    };
  });

type SaveInput = {
  guildId: string;
  channels: Record<string, string>;
  roles: Record<string, string[] | string>;
  settings: Record<string, number>;
};

export const saveGuild = createServerFn({ method: "POST" })
  .inputValidator((d: SaveInput) => {
    if (!isSnowflake(d?.guildId)) throw new Error("Złe ID serwera");
    const channels: Record<string, string> = {};
    for (const k of CHANNEL_KEYS) if (isSnowflake(d.channels?.[k])) channels[k] = d.channels[k];
    const roles: Record<string, string[] | string> = {};
    for (const f of ROLE_FIELDS) {
      const v = d.roles?.[f.key];
      if (f.multi) roles[f.key] = Array.isArray(v) ? v.filter(isSnowflake).slice(0, 50) : [];
      else if (isSnowflake(v)) roles[f.key] = v;
    }
    const settings: Record<string, number> = {};
    for (const f of NUM_FIELDS) {
      const n = Math.round(Number(d.settings?.[f.key]));
      settings[f.key] = Number.isFinite(n) && n >= 1 && n <= 365 ? n : f.def;
    }
    return { guildId: d.guildId, channels, roles, settings };
  })
  .handler(async ({ data }) => {
    const { requireGuild } = await import("./discord.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { s } = await requireGuild(data.guildId);
    const { error } = await supabaseAdmin.from("guild_configs").upsert({
      guild_id: data.guildId,
      channels: data.channels,
      roles: data.roles,
      settings: data.settings,
      updated_by: s.discord_user_id,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Nie udało się zapisać");
    return { ok: true };
  });

// Ustawia flagę w panels — bot odczyta ją przy następnym pobraniu ustawień (do ~30 s) i wyśle panel.
export const sendPanel = createServerFn({ method: "POST" })
  .inputValidator((d: { guildId: string; panel: string }) => {
    if (!isSnowflake(d?.guildId)) throw new Error("Złe ID serwera");
    if (!PANEL_KEYS.includes(d?.panel as (typeof PANEL_KEYS)[number])) throw new Error("Nieznany panel");
    return d;
  })
  .handler(async ({ data }) => {
    const { requireGuild } = await import("./discord.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireGuild(data.guildId);
    const { data: cfg } = await supabaseAdmin.from("guild_configs").select("channels, panels").eq("guild_id", data.guildId).maybeSingle();
    const selected = (await import("./bot-slots")).PANEL_SLOTS.find((p) => p.key === data.panel);
    if (!selected) throw new Error("Nieznany panel");
    const slot = selected.slot;
    if (!isSnowflake((cfg?.channels as Record<string, string> | null)?.[slot])) throw new Error("Najpierw ustaw i zapisz kanał dla tego panelu");
    const panels = { ...((cfg?.panels as Record<string, string> | null) ?? {}), [data.panel]: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("guild_configs").upsert({ guild_id: data.guildId, panels });
    if (error) throw new Error("Nie udało się zlecić wysyłki");
    return { ok: true };
  });
