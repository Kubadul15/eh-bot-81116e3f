import { z } from "zod";
import { isSnowflake } from "./bot-slots";

// Wspólne dla kreatora wiadomości (UI) i walidacji po stronie serwera.
const https = z
  .string()
  .max(2048)
  .refine(
    (v) => !v || /^https:\/\//.test(v),
    "Adres obrazka lub linku musi zaczynać się od https://",
  );

export const composerFieldSchema = z.object({
  name: z.string().trim().min(1, "Pole embeda: wpisz nazwę").max(256),
  value: z.string().trim().min(1, "Pole embeda: wpisz wartość").max(1024),
  inline: z.boolean(),
});

export const composerEmbedSchema = z.object({
  author: z.string().max(256),
  authorIcon: https,
  title: z.string().max(256),
  url: https,
  description: z.string().max(4000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Zły kolor"),
  thumbnail: https,
  image: https,
  footer: z.string().max(2048),
  footerIcon: https,
  timestamp: z.boolean(),
  fields: z.array(composerFieldSchema).max(10),
});
export type ComposerEmbed = z.infer<typeof composerEmbedSchema>;
export type ComposerField = z.infer<typeof composerFieldSchema>;

const snowflake = z.string().refine(isSnowflake, "Zły identyfikator");

export const composerSchema = z
  .object({
    channelId: snowflake,
    mode: z.enum(["bot", "webhook"]),
    webhookName: z.string().trim().max(80),
    webhookAvatar: https,
    content: z.string().max(2000),
    pingRoleIds: z.array(snowflake).max(10),
    pingEveryone: z.boolean(),
    embeds: z.array(composerEmbedSchema).max(3),
  })
  .superRefine((m, ctx) => {
    const hasEmbed = m.embeds.some(
      (e) => e.title || e.description || e.image || e.author || e.fields.length,
    );
    if (!m.content.trim() && !hasEmbed && !m.pingRoleIds.length && !m.pingEveryone)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wiadomość jest pusta – dodaj treść albo embed",
      });
    if (embedChars(m.embeds) > 6000)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Embedy są za długie (limit Discorda: 6000 znaków łącznie)",
      });
  });
export type ComposerMessage = z.infer<typeof composerSchema>;

export const emptyComposerEmbed = (): ComposerEmbed => ({
  author: "",
  authorIcon: "",
  title: "",
  url: "",
  description: "",
  color: "#5865f2",
  thumbnail: "",
  image: "",
  footer: "",
  footerIcon: "",
  timestamp: false,
  fields: [],
});
export const emptyComposer = (): ComposerMessage => ({
  channelId: "",
  mode: "bot",
  webhookName: "",
  webhookAvatar: "",
  content: "",
  pingRoleIds: [],
  pingEveryone: false,
  embeds: [emptyComposerEmbed()],
});

export function embedChars(embeds: ComposerEmbed[]): number {
  return embeds.reduce(
    (n, e) =>
      n +
      e.title.length +
      e.description.length +
      e.author.length +
      e.footer.length +
      e.fields.reduce((m, f) => m + f.name.length + f.value.length, 0),
    0,
  );
}
