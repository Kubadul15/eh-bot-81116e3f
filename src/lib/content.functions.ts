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