import { createServerFn } from "@tanstack/react-start";
import { composerSchema, type ComposerEmbed } from "./message-config";
import { isSnowflake } from "./bot-slots";
import { metaOf, premiumActive } from "./premium";

// Wysyła wiadomość od razu (bez udziału procesu bota): jako bot albo przez webhook z własną nazwą i avatarem.
const toEmbed = (e: ComposerEmbed) => ({
  title: e.title || undefined,
  url: e.url || undefined,
  description: e.description || undefined,
  color: parseInt(e.color.slice(1), 16),
  author: e.author ? { name: e.author, icon_url: e.authorIcon || undefined } : undefined,
  footer: e.footer ? { text: e.footer, icon_url: e.footerIcon || undefined } : undefined,
  thumbnail: e.thumbnail ? { url: e.thumbnail } : undefined,
  image: e.image ? { url: e.image } : undefined,
  fields: e.fields.length ? e.fields : undefined,
  timestamp: e.timestamp ? new Date().toISOString() : undefined,
});

// Dane do podglądu „jak na Discordzie” (Premium): prawdziwa nazwa i avatar bota na tym serwerze oraz nazwa i ikona serwera.
const viewCache = new Map<string, { at: number; value: BotView }>();
export type BotView = {
  bot: { id: string; name: string; avatar: string };
  guild: { id: string; name: string; icon: string | null };
};
export const getBotView = createServerFn({ method: "GET" })
  .inputValidator((d: { guildId: string }) => {
    if (!isSnowflake(d?.guildId)) throw new Error("Złe ID serwera");
    return { guildId: d.guildId };
  })
  .handler(async ({ data }): Promise<BotView> => {
    const { requireGuild, bot } = await import("./discord.server");
    await requireGuild(data.guildId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin
      .from("guild_configs")
      .select("settings")
      .eq("guild_id", data.guildId)
      .maybeSingle();
    if (!premiumActive(metaOf(cfg?.settings)))
      throw new Error("Podgląd jak na Discordzie to funkcja planu Premium.");
    const hit = viewCache.get(data.guildId);
    if (hit && Date.now() - hit.at < 600_000) return hit.value;

    const { discordAvatarUrl, discordIconUrl } = await import("./discord-format");
    const meRes = await bot("/users/@me");
    if (!meRes.ok) throw new Error("Nie udało się pobrać danych bota");
    const me = (await meRes.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar: string | null;
    };
    const [memberRes, guildRes] = await Promise.all([
      bot(`/guilds/${data.guildId}/members/${me.id}`),
      bot(`/guilds/${data.guildId}`),
    ]);
    const member = memberRes.ok
      ? ((await memberRes.json()) as { nick?: string | null; avatar?: string | null })
      : {};
    const g = guildRes.ok
      ? ((await guildRes.json()) as { id: string; name: string; icon: string | null })
      : { id: data.guildId, name: "Serwer", icon: null };
    const value: BotView = {
      bot: {
        id: me.id,
        name: member.nick || me.global_name || me.username,
        avatar: member.avatar
          ? `https://cdn.discordapp.com/guilds/${data.guildId}/users/${me.id}/avatars/${member.avatar}.png?size=128`
          : discordAvatarUrl(me.id, me.avatar),
      },
      guild: { id: g.id, name: g.name, icon: discordIconUrl(g.id, g.icon) },
    };
    if (viewCache.size > 300) viewCache.clear();
    viewCache.set(data.guildId, { at: Date.now(), value });
    return value;
  });

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const raw = data as { guildId?: unknown; message?: unknown } | null;
    if (!isSnowflake(raw?.guildId)) throw new Error("Złe ID serwera");
    const parsed = composerSchema.safeParse(raw?.message);
    if (!parsed.success)
      throw new Error(parsed.error.issues[0]?.message ?? "Nieprawidłowa wiadomość");
    return { guildId: raw.guildId, message: parsed.data };
  })
  .handler(async ({ data }) => {
    const { requireGuild, bot, API } = await import("./discord.server");
    const { guildId, message: m } = data;
    await requireGuild(guildId);
    const { assertNotMaintenance } = await import("./admin.server");
    await assertNotMaintenance();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin
      .from("guild_configs")
      .select("settings")
      .eq("guild_id", guildId)
      .maybeSingle();
    const meta = metaOf(cfg?.settings);
    if (meta.blocked)
      throw new Error(
        `Ten serwer został zablokowany przez właściciela bota: ${meta.blocked.reason}`,
      );
    // Free: jeden embed i wysyłka jako bot; webhook (własna nazwa i avatar) oraz do 3 embedów to Premium
    if (!premiumActive(meta) && (m.mode === "webhook" || m.embeds.length > 1)) {
      throw new Error(
        "Webhook i wiele embedów w jednej wiadomości to funkcje planu Premium (jednorazowo 20 zł, na zawsze).",
      );
    }

    const ch = await bot(`/channels/${m.channelId}`);
    if (!ch.ok) throw new Error("Kanał jest niedostępny dla bota");
    const info = (await ch.json()) as { guild_id: string; type: number };
    if (info.guild_id !== guildId || ![0, 5].includes(info.type))
      throw new Error("Wybierz zwykły kanał tekstowy z tego serwera");

    const mentions = [m.pingEveryone ? "@everyone" : "", ...m.pingRoleIds.map((id) => `<@&${id}>`)]
      .filter(Boolean)
      .join(" ");
    const body: Record<string, unknown> = {
      content: [mentions, m.content].filter(Boolean).join("\n") || undefined,
      embeds: m.embeds
        .filter((e) => e.title || e.description || e.image || e.author || e.fields.length)
        .map(toEmbed),
      allowed_mentions: { parse: m.pingEveryone ? ["everyone"] : [], roles: m.pingRoleIds },
    };
    const auth = {
      authorization: `Bot ${process.env["DISCORD_BOT_TOKEN"]}`,
      "content-type": "application/json",
    };

    let url = `${API}/channels/${m.channelId}/messages`;
    let headers: Record<string, string> = auth;
    if (m.mode === "webhook") {
      // webhook utworzony przez bota na tym kanale (jeden na kanał, nazwa "EH Bot"); jeśli go nie ma – tworzymy
      const list = await fetch(`${API}/channels/${m.channelId}/webhooks`, { headers: auth });
      if (list.status === 403)
        throw new Error("Bot nie ma uprawnienia „Zarządzanie webhookami” na tym kanale");
      let hook = list.ok
        ? ((await list.json()) as { id: string; token?: string; name: string }[]).find(
            (w) => w.token && w.name === "EH Bot",
          )
        : undefined;
      if (!hook) {
        const created = await fetch(`${API}/channels/${m.channelId}/webhooks`, {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ name: "EH Bot" }),
        });
        if (!created.ok)
          throw new Error(
            "Nie udało się utworzyć webhooka – sprawdź uprawnienie „Zarządzanie webhookami”",
          );
        hook = (await created.json()) as { id: string; token?: string; name: string };
      }
      url = `${API}/webhooks/${hook.id}/${hook.token}?wait=true`;
      headers = { "content-type": "application/json" };
      body["username"] = m.webhookName || "Emergency Hamburg";
      if (m.webhookAvatar) body["avatar_url"] = m.webhookAvatar;
    }

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      if (res.status === 403)
        throw new Error(
          "Bot nie ma uprawnień do pisania na tym kanale (sprawdź „Wysyłanie wiadomości” i „Osadzanie linków”)",
        );
      throw new Error(
        `Discord odrzucił wiadomość (${res.status}) – sprawdź adresy obrazków i długość tekstów`,
      );
    }
    const sent = (await res.json()) as { id: string };
    return {
      ok: true as const,
      link: `https://discord.com/channels/${guildId}/${m.channelId}/${sent.id}`,
    };
  });
