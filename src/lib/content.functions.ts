import { createServerFn } from "@tanstack/react-start";
import { contentSchema } from "./content-config";
import { isSnowflake } from "./bot-slots";

export const saveContent = createServerFn({ method: "POST" })
  .inputValidator((value: { guildId: string; content: unknown }) => {
    if (!isSnowflake(value?.guildId)) throw new Error("Złe ID serwera");
    return { guildId: value.guildId, content: contentSchema.parse(value.content) };
  }).handler(async ({ data }) => {
    const { requireGuild } = await import("./discord.server");
    const { s } = await requireGuild(data.guildId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("guild_configs").upsert({ guild_id: data.guildId, content: data.content, updated_by: s.discord_user_id, updated_at: new Date().toISOString() });
    if (error) throw new Error("Nie udało się zapisać treści");
    return { ok: true };
  });

export const uploadImage = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("Brak zdjęcia");
    return data;
  }).handler(async ({ data }) => {
    const guildId = data.get("guildId"), file = data.get("file");
    if (!isSnowflake(guildId) || !(file instanceof File)) throw new Error("Nieprawidłowe zdjęcie");
    const { requireGuild } = await import("./discord.server");
    await requireGuild(guildId);
    if (!file.size || file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) throw new Error("Wybierz PNG, JPG, WEBP lub GIF do 5 MB");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = crypto.randomUUID();
    const { error } = await supabaseAdmin.storage.from("bot-images").upload(id, file, { contentType: file.type });
    if (error) throw new Error("Nie udało się dodać zdjęcia");
    const { getRequest } = await import("@tanstack/react-start/server");
    return { url: `${new URL(getRequest().url).origin}/api/public/bot/image?id=${id}` };
  });

export const sendAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((data: { guildId: string; channelId: string; embed: unknown }) => {
    if (!isSnowflake(data?.guildId) || !isSnowflake(data?.channelId)) throw new Error("Wybierz kanał");
    const embed = contentSchema.shape.embeds.element.parse(data.embed);
    if (!embed.title && !embed.description && !embed.image) throw new Error("Dodaj treść lub zdjęcie");
    return { ...data, embed };
  }).handler(async ({ data }) => {
    const { requireGuild, bot, API } = await import("./discord.server");
    await requireGuild(data.guildId);
    const channel = await bot(`/channels/${data.channelId}`);
    if (!channel.ok) throw new Error("Kanał jest niedostępny");
    const info = await channel.json() as { guild_id: string; type: number };
    if (info.guild_id !== data.guildId || ![0, 5].includes(info.type)) throw new Error("Nieprawidłowy kanał");
    const e = data.embed;
    const result = await fetch(`${API}/channels/${data.channelId}/messages`, { method: "POST", headers: { authorization: `Bot ${process.env["DISCORD_BOT_TOKEN"]}`, "content-type": "application/json" }, body: JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: e.title || undefined, description: e.description || undefined, color: parseInt(e.color.slice(1), 16), footer: e.footer ? { text: e.footer } : undefined, image: e.image ? { url: e.image } : undefined, thumbnail: e.thumbnail ? { url: e.thumbnail } : undefined }] }) });
    if (!result.ok) throw new Error("Nie udało się wysłać — sprawdź uprawnienia bota do kanału");
    return { ok: true };
  });