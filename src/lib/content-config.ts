import { z } from "zod";
import { MESSAGE_EMBEDS } from "./embed-catalog";

export const EMBED_TYPES = [
  ["urzad", "Urząd — panel"], ["opinie", "Pochwały i skargi — panel"],
  ["staff", "Administracja — panel"], ["tickety", "Tickety — panel"],
  ["rekrutacja", "Rekrutacja — panel"], ["recruit", "Rekrutacja — aplikacje i decyzje"],
  ["ban", "Bany"], ["tickets", "Tickety — wiadomości"], ["mobywatel", "Dokumenty i mObywatel"],
  ["staff_messages", "Administracja — wiadomości"], ["embed", "Własne ogłoszenie"],
  ["powitanie", "Powitanie nowych osób (znaczniki: {user} {server} {count})"],
  ["ekonomia", "Ekonomia — panel"], ["sad", "Sąd — panel"], ["adwokaci", "Adwokaci — panel"],
  ["prawnicy", "Prawnicy — panel"], ["kuratorzy", "Kuratorzy — panel"], ["weryfikacja", "Weryfikacja — panel"],
  ...MESSAGE_EMBEDS,
] as const;
const image = z.string().max(2048).refine(v => !v || /^https:\/\//.test(v), "Zdjęcie musi mieć adres HTTPS");
export const embedSchema = z.object({ title: z.string().max(256).default(""), description: z.string().max(2000).default(""), footer: z.string().max(200).default(""), image, thumbnail: image, color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#202020") });
export const recruitmentSchema = z.object({
  open: z.boolean(),
  positions: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/), label: z.string().trim().min(1).max(40), emoji: z.string().max(8).default(""), desc: z.string().max(80), roleId: z.string().refine(v => !v || /^\d{17,20}$/.test(v)), open: z.boolean() })).max(25),
  questions: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/), label: z.string().trim().min(1).max(45), style: z.enum(["short", "long"]), required: z.boolean(), placeholder: z.string().max(100) })).max(15),
}).superRefine((r, ctx) => {
  for (const key of ["positions", "questions"] as const) if (new Set(r[key].map(x => x.id)).size !== r[key].length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Powtarzające się ID", path: [key] });
});
export const contentSchema = z.object({ recruitment: recruitmentSchema, embeds: z.record(embedSchema) });
export type ContentConfig = z.infer<typeof contentSchema>;
export type EmbedConfig = z.infer<typeof embedSchema>;
export const emptyEmbed = (): EmbedConfig => ({ title: "", description: "", footer: "", image: "", thumbnail: "", color: "#202020" });
export const defaultContent = (): ContentConfig => ({ recruitment: { open: false, positions: [], questions: [] }, embeds: {} });
export function readContent(value: unknown): ContentConfig { const result = contentSchema.safeParse(value); return result.success ? result.data : defaultContent(); }