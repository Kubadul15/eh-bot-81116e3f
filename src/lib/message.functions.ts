import { createServerFn } from "@tanstack/react-start";
import { composerSchema, type ComposerEmbed } from "./message-config";
import { isSnowflake } from "./bot-slots";

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
