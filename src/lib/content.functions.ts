import { createServerFn } from "@tanstack/react-start";
import { contentSchema, readContent } from "./content-config";
import { isSnowflake } from "./bot-slots";
import { hasFeature, limitsFor, metaOf, premiumActive } from "./premium";

export const saveContent = createServerFn({ method: "POST" })
  .inputValidator((value: { guildId: string; content: unknown }) => {
    if (!isSnowflake(value?.guildId)) throw new Error("Złe ID serwera");
    return { guildId: value.guildId, content: contentSchema.parse(value.content) };
  })
  .handler(async ({ data }) => {
    const { requireGuild } = await import("./discord.server");
    const { s } = await requireGuild(data.guildId);
    const { assertNotMaintenance } = await import("./admin.server");
    await assertNotMaintenance();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // limity planu: Free ma mniej stanowisk i pytań rekrutacji, a własny wygląd wiadomości (embedy) jest funkcją Premium
    const { data: cur } = await supabaseAdmin
      .from("guild_configs")
      .select("settings, content")
      .eq("guild_id", data.guildId)
      .maybeSingle();
    const meta = metaOf(cur?.settings);
    if (meta.blocked)
      throw new Error(
        `Ten serwer został zablokowany przez właściciela bota: ${meta.blocked.reason}`,
      );
    const lim = limitsFor(meta),
      r = data.content.recruitment;
    if (r.positions.length > lim.recruitPositions)
      throw new Error(
        `Limit planu: ${lim.recruitPositions} stanowisk w rekrutacji (masz ${r.positions.length}). Usuń nadmiar albo kup Premium (zakładka Cennik).`,
      );
    if (r.questions.length > lim.recruitQuestions)
      throw new Error(
        `Limit planu: ${lim.recruitQuestions} pytań w formularzu (masz ${r.questions.length}). Usuń nadmiar albo kup Premium (zakładka Cennik).`,
      );
    const tk = data.content.tickets;
    if (tk.positions.length > lim.ticketTypes)
      throw new Error(
        `Limit planu: ${lim.ticketTypes} rodzajów ticketów w menu (masz ${tk.positions.length}). Usuń nadmiar albo kup Premium (zakładka Cennik).`,
      );
    if (tk.images && !hasFeature(meta, "ticketImages"))
      throw new Error(
        "Obrazki w formularzu ticketu to funkcja Premium (albo nadana przez właściciela bota).",
      );
    const content = premiumActive(meta)
      ? data.content
      : { ...data.content, embeds: readContent(cur?.content).embeds };
    const { error } = await supabaseAdmin
      .from("guild_configs")
      .upsert({
        guild_id: data.guildId,
        content,
        updated_by: s.discord_user_id,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error("Nie udało się zapisać treści");
    return { ok: true };
  });

export const uploadImage = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("Brak zdjęcia");
    return data;
  })
  .handler(async ({ data }) => {
    const guildId = data.get("guildId"),
      file = data.get("file");
    if (!isSnowflake(guildId) || !(file instanceof File)) throw new Error("Nieprawidłowe zdjęcie");
    const { requireGuild } = await import("./discord.server");
    await requireGuild(guildId);
    if (
      !file.size ||
      file.size > 5 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)
    )
      throw new Error("Wybierz PNG, JPG, WEBP lub GIF do 5 MB");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = crypto.randomUUID();
    const { error } = await supabaseAdmin.storage
      .from("bot-images")
      .upload(id, file, { contentType: file.type });
    if (error) throw new Error("Nie udało się dodać zdjęcia");
    const { getRequest } = await import("@tanstack/react-start/server");
    return { url: `${new URL(getRequest().url).origin}/api/public/bot/image?id=${id}` };
  });

export const sendAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((data: { guildId: string; channelId: string; embed: unknown }) => {
    if (!isSnowflake(data?.guildId) || !isSnowflake(data?.channelId))
      throw new Error("Wybierz kanał");
    const embed = contentSchema.shape.embeds.element.parse(data.embed);
    if (!embed.title && !embed.description && !embed.image)
      throw new Error("Dodaj treść lub zdjęcie");
    return { ...data, embed };
  })
  .handler(async ({ data }) => {
    const { requireGuild, bot, API } = await import("./discord.server");
    await requireGuild(data.guildId);
    const channel = await bot(`/channels/${data.channelId}`);
    if (!channel.ok) throw new Error("Kanał jest niedostępny");
    const info = (await channel.json()) as { guild_id: string; type: number };
    if (info.guild_id !== data.guildId || ![0, 5].includes(info.type))
      throw new Error("Nieprawidłowy kanał");
    const e = data.embed;
    const result = await fetch(`${API}/channels/${data.channelId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bot ${process.env["DISCORD_BOT_TOKEN"]}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: e.title || undefined,
            description: e.description || undefined,
            color: parseInt(e.color.slice(1), 16),
            footer: e.footer ? { text: e.footer } : undefined,
            image: e.image ? { url: e.image } : undefined,
            thumbnail: e.thumbnail ? { url: e.thumbnail } : undefined,
          },
        ],
      }),
    });
    if (!result.ok) throw new Error("Nie udało się wysłać — sprawdź uprawnienia bota do kanału");
    return { ok: true };
  });
