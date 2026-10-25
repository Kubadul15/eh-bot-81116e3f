import { createServerFn } from "@tanstack/react-start";
import {
  CHANNEL_KEYS,
  ROLE_FIELDS,
  NUM_FIELDS,
  TEXT_FIELDS,
  TEXT_KEYS,
  PANEL_KEYS,
  isSnowflake,
} from "./bot-slots";
import {
  OWNER_ID,
  PREMIUM_PANELS,
  keepAdmin,
  metaOf,
  premiumActive,
  publicPremium,
} from "./premium";

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { getSession } = await import("./discord.server");
  const s = await getSession();
  return {
    clientId: process.env["DISCORD_CLIENT_ID"] ?? null,
    user: s ? { id: s.discord_user_id, username: s.username, avatar: s.avatar } : null,
    isOwner: !!s && s.discord_user_id === OWNER_ID, // tylko do pokazania odnośnika „Admin”; dostęp i tak egzekwuje serwer
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
  // plan Premium widoczny na kafelkach serwerów
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfgs } = await supabaseAdmin
    .from("guild_configs")
    .select("guild_id, settings")
    .in(
      "guild_id",
      mine.map((g) => g.id),
    );
  const plan = new Map((cfgs ?? []).map((c) => [c.guild_id, premiumActive(metaOf(c.settings))]));
  return mine.map((g, i) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    botIn: checks[i],
    premium: plan.get(g.id) ?? false,
  }));
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
    const [cr, rr] = await Promise.all([
      bot(`/guilds/${g.id}/channels`),
      bot(`/guilds/${g.id}/roles`),
    ]);
    if (!cr.ok || !rr.ok)
      return { guild: { id: g.id, name: g.name, icon: g.icon }, botIn: false as const };
    const channels = ((await cr.json()) as Ch[])
      .filter((c) => [0, 2, 4, 5, 13].includes(c.type)) // tekstowe, głosowe (poczekalnia), kategorie, ogłoszeniowe, sceny
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, name: c.name, type: c.type }));
    const roles = ((await rr.json()) as Role[])
      .filter((r) => !r.managed && r.id !== g.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.color }));
    const { data: cfg } = await supabaseAdmin
      .from("guild_configs")
      .select("*")
      .eq("guild_id", g.id)
      .maybeSingle();
    // klient widzi tylko liczby ustawień (bez zastrzeżonego bloku _admin: notatki, płatności) i status planu
    const settings = Object.fromEntries(
      Object.entries((cfg?.settings ?? {}) as Record<string, unknown>).filter(
        ([k, v]) => !k.startsWith("_") && typeof v === "number",
      ),
    ) as Record<string, number>;
    const texts = Object.fromEntries(
      Object.entries((cfg?.settings ?? {}) as Record<string, unknown>).filter(
        ([k, v]) => TEXT_KEYS.includes(k) && typeof v === "string",
      ),
    ) as Record<string, string>;
    return {
      guild: { id: g.id, name: g.name, icon: g.icon },
      botIn: true as const,
      channels,
      roles,
      premium: publicPremium(metaOf(cfg?.settings)),
      config: {
        channels: (cfg?.channels ?? {}) as Record<string, string>,
        roles: (cfg?.roles ?? {}) as Record<string, string[] | string>,
        settings,
        texts,
        content: cfg?.content ?? {},
      },
    };
  });

// Wspólne zabezpieczenie zapisów klienta: tryb serwisowy i blokada serwera przez właściciela bota.
async function assertWritable(guildId: string) {
  const { assertNotMaintenance } = await import("./admin.server");
  await assertNotMaintenance();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("guild_configs")
    .select("settings")
    .eq("guild_id", guildId)
    .maybeSingle();
  const meta = metaOf(data?.settings);
  if (meta.blocked)
    throw new Error(`Ten serwer został zablokowany przez właściciela bota: ${meta.blocked.reason}`);
  return { settings: data?.settings ?? {}, meta };
}

// Bezpłatny trial Premium na 3 dni: każdy zarządca serwera może go uruchomić raz (jeden na serwer i na konto Discord).
export const startTrial = createServerFn({ method: "POST" })
  .inputValidator((d: { guildId: string }) => {
    if (!isSnowflake(d?.guildId)) throw new Error("Zły ID serwera");
    return { guildId: d.guildId };
  })
  .handler(async ({ data }) => {
    const { requireGuild } = await import("./discord.server");
    const { s } = await requireGuild(data.guildId);
    const admin = await import("./admin.server");
    await admin.assertNotMaintenance();
    return { ok: true as const, ...(await admin.startTrial(s.discord_user_id, data.guildId)) };
  });

type SaveInput = {
  guildId: string;
  channels: Record<string, string>;
  roles: Record<string, string[] | string>;
  settings: Record<string, number>;
  texts?: Record<string, string>;
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
      settings[f.key] = Number.isFinite(n) && n >= (f.min ?? 1) && n <= (f.max ?? 365) ? n : f.def;
    }
    // ustawienia tekstowe (np. link do dźwięku poczekalni): tylko adresy http(s), reszta to pusty tekst
    const texts: Record<string, string> = {};
    for (const f of TEXT_FIELDS) {
      const v = String(d.texts?.[f.key] ?? "").trim().slice(0, f.max);
      texts[f.key] = /^https?:\/\/[^\s]+$/i.test(v) ? v : "";
    }
    return { guildId: d.guildId, channels, roles, settings: { ...settings, ...texts } };
  })
  .handler(async ({ data }) => {
    const { requireGuild } = await import("./discord.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { s } = await requireGuild(data.guildId);
    const { settings: existing } = await assertWritable(data.guildId);
    const { error } = await supabaseAdmin.from("guild_configs").upsert({
      guild_id: data.guildId,
      channels: data.channels,
      roles: data.roles,
      settings: keepAdmin(existing, data.settings) as never, // zapis klienta nie może zgubić bloku _admin (plan, blokada)
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
    if (!PANEL_KEYS.includes(d?.panel as (typeof PANEL_KEYS)[number]))
      throw new Error("Nieznany panel");
    return d;
  })
  .handler(async ({ data }) => {
    const { requireGuild } = await import("./discord.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireGuild(data.guildId);
    const { meta } = await assertWritable(data.guildId);
    if ((PREMIUM_PANELS as readonly string[]).includes(data.panel) && !premiumActive(meta)) {
      throw new Error(
        "Ten panel jest dostępny w planie Premium (jednorazowo 20 zł, na zawsze). Szczegóły w zakładce Cennik.",
      );
    }
    const { data: cfg } = await supabaseAdmin
      .from("guild_configs")
      .select("channels, panels")
      .eq("guild_id", data.guildId)
      .maybeSingle();
    const selected = (await import("./bot-slots")).PANEL_SLOTS.find((p) => p.key === data.panel);
    if (!selected) throw new Error("Nieznany panel");
    const slot = selected.slot;
    if (!isSnowflake((cfg?.channels as Record<string, string> | null)?.[slot]))
      throw new Error("Najpierw ustaw i zapisz kanał dla tego panelu");
    const panels = {
      ...((cfg?.panels as Record<string, string> | null) ?? {}),
      [data.panel]: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin
      .from("guild_configs")
      .upsert({ guild_id: data.guildId, panels });
    if (error) throw new Error("Nie udało się zlecić wysyłki");
    return { ok: true };
  });
