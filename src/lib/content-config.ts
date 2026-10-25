import { z } from "zod";
import { MESSAGE_EMBEDS } from "./embed-catalog";

export const EMBED_TYPES = [
  ["urzad", "Urząd — panel"],
  ["opinie", "Pochwały i skargi — panel"],
  ["staff", "Administracja — panel"],
  ["tickety", "Tickety — panel"],
  ["rekrutacja", "Rekrutacja — panel"],
  ["recruit", "Rekrutacja — aplikacje i decyzje"],
  ["ban", "Bany"],
  ["tickets", "Tickety — wiadomości"],
  ["mobywatel", "Dokumenty i mObywatel"],
  ["staff_messages", "Administracja — wiadomości"],
  ["embed", "Własne ogłoszenie"],
  ["powitanie", "Powitanie nowych osób (znaczniki: {user} {server} {count})"],
  ["ekonomia", "Ekonomia — panel"],
  ["sad", "Sąd — panel"],
  ["adwokaci", "Adwokaci — panel"],
  ["prawnicy", "Prawnicy — panel"],
  ["kuratorzy", "Kuratorzy — panel"],
  ["weryfikacja", "Weryfikacja — panel"],
  ...MESSAGE_EMBEDS,
] as const;
const image = z
  .string()
  .max(2048)
  .refine((v) => !v || /^https:\/\//.test(v), "Zdjęcie musi mieć adres HTTPS");
export const embedSchema = z.object({
  title: z.string().max(256).default(""),
  description: z.string().max(2000).default(""),
  footer: z.string().max(200).default(""),
  image,
  thumbnail: image,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#202020"),
});
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/);
const roleIdSchema = z.string().refine((v) => !v || /^\d{17,20}$/.test(v));
// stanowisko w rekrutacji = rodzaj ticketu w menu wyboru (ta sama budowa: nazwa, emoji, opis, ranga, otwarte/zamknięte)
const positionSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1).max(40),
  emoji: z.string().max(8).default(""),
  desc: z.string().max(80),
  roleId: roleIdSchema,
  open: z.boolean(),
});
const questionSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1).max(45),
  style: z.enum(["short", "long"]),
  required: z.boolean(),
  placeholder: z.string().max(100),
});
type Sectioned = { positions: { id: string }[]; questions: { id: string }[] };
const uniqueIds = (r: Sectioned, ctx: z.RefinementCtx) => {
  for (const key of ["positions", "questions"] as const)
    if (new Set(r[key].map((x) => x.id)).size !== r[key].length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Powtarzające się ID", path: [key] });
};
export const recruitmentSchema = z
  .object({
    open: z.boolean(),
    positions: z.array(positionSchema).max(25),
    questions: z.array(questionSchema).max(15),
  })
  .superRefine(uniqueIds);
/** Formularz w oknie Discorda ma najwyżej 5 pól: przy włączonych obrazkach jedno z nich zajmuje pole wgrywania. */
export const TICKET_FORM_FIELDS = 5;
export const ticketsSchema = z
  .object({
    open: z.boolean(),
    positions: z.array(positionSchema).max(25), // rodzaje ticketów (opcje menu wyboru; Discord pozwala na 25)
    questions: z.array(questionSchema).max(TICKET_FORM_FIELDS),
    images: z.boolean(), // pole „dodaj obrazki” w formularzu (Premium albo funkcja nadana przez właściciela)
    maxOpen: z.number().int().min(1).max(10), // ile otwartych ticketów naraz może mieć jedna osoba
  })
  .superRefine((r, ctx) => {
    uniqueIds(r, ctx);
    if (r.questions.length + (r.images ? 1 : 0) > TICKET_FORM_FIELDS)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Formularz Discorda ma maks. ${TICKET_FORM_FIELDS} pól – z obrazkami możesz dać ${TICKET_FORM_FIELDS - 1} pytania`,
        path: ["questions"],
      });
  });
// domyślne tickety = to, co bot robił zawsze (pomoc, zgłoszenie, odwołanie, współpraca, inne + temat, opis, nick)
export const defaultTickets = (): z.infer<typeof ticketsSchema> => ({
  open: true,
  images: false,
  maxOpen: 3,
  positions: [
    {
      id: "pomoc",
      label: "Pomoc ogólna",
      emoji: "❓",
      desc: "Pytania i problemy",
      roleId: "",
      open: true,
    },
    {
      id: "zgloszenie",
      label: "Zgłoszenie gracza",
      emoji: "🚨",
      desc: "Łamanie regulaminu przez gracza",
      roleId: "",
      open: true,
    },
    {
      id: "odwolanie",
      label: "Odwołanie od bana",
      emoji: "🔨",
      desc: "Odwołaj się od nałożonej kary",
      roleId: "",
      open: true,
    },
    {
      id: "wspolpraca",
      label: "Współpraca",
      emoji: "🤝",
      desc: "Partnerstwa i propozycje",
      roleId: "",
      open: true,
    },
    { id: "inne", label: "Inne", emoji: "📩", desc: "Pozostałe sprawy", roleId: "", open: true },
  ],
  questions: [
    {
      id: "subject",
      label: "Temat",
      style: "short",
      required: true,
      placeholder: "Krótko: czego dotyczy sprawa?",
    },
    { id: "desc", label: "Opisz dokładnie sprawę", style: "long", required: true, placeholder: "" },
    { id: "nick", label: "Twój nick Roblox", style: "short", required: false, placeholder: "" },
  ],
});
export const contentSchema = z.object({
  recruitment: recruitmentSchema,
  tickets: ticketsSchema.default(defaultTickets),
  embeds: z.record(embedSchema),
});
export type ContentConfig = z.infer<typeof contentSchema>;
export type EmbedConfig = z.infer<typeof embedSchema>;
export type TicketsConfig = z.infer<typeof ticketsSchema>;
export type PositionConfig = z.infer<typeof positionSchema>;
export type QuestionConfig = z.infer<typeof questionSchema>;
export const emptyEmbed = (): EmbedConfig => ({
  title: "",
  description: "",
  footer: "",
  image: "",
  thumbnail: "",
  color: "#202020",
});
export const defaultContent = (): ContentConfig => ({
  recruitment: { open: false, positions: [], questions: [] },
  tickets: defaultTickets(),
  embeds: {},
});
export function readContent(value: unknown): ContentConfig {
  const result = contentSchema.safeParse(value);
  return result.success ? result.data : defaultContent();
}
