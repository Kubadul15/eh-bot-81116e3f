import { describe, expect, it } from "vitest";
import {
  TICKET_FORM_FIELDS,
  contentSchema,
  defaultContent,
  defaultTickets,
  readContent,
  ticketsSchema,
} from "@/lib/content-config";

const old = {
  recruitment: { open: true, positions: [], questions: [] },
  embeds: {
    rekrutacja: {
      title: "x",
      description: "",
      footer: "",
      image: "",
      thumbnail: "",
      color: "#112233",
    },
  },
};

describe("konfiguracja ticketów", () => {
  it("stare dane bez sekcji tickets nadal się wczytują i dostają domyślne tickety (nic nie ginie)", () => {
    const c = readContent(old);
    expect(c.recruitment.open).toBe(true);
    expect(c.embeds["rekrutacja"]?.color).toBe("#112233");
    expect(c.tickets).toEqual(defaultTickets());
  });

  it("domyślne tickety odpowiadają dotychczasowemu zachowaniu bota", () => {
    const d = defaultTickets();
    expect(d.positions.map((p) => p.id)).toEqual([
      "pomoc",
      "zgloszenie",
      "odwolanie",
      "wspolpraca",
      "inne",
    ]);
    expect(d.questions.map((q) => q.id)).toEqual(["subject", "desc", "nick"]);
    expect(d.open).toBe(true);
    expect(d.images).toBe(false);
    expect(d.maxOpen).toBe(3);
    expect(ticketsSchema.safeParse(d).success).toBe(true);
    expect(defaultContent().tickets).toEqual(d);
  });

  it("formularz Discorda: maks. 5 pól, a z obrazkami 4 pytania", () => {
    const q = (n: number) =>
      Array.from({ length: n }, (_, k) => ({
        id: `q${k}`,
        label: `P${k}`,
        style: "short" as const,
        required: false,
        placeholder: "",
      }));
    const base = defaultTickets();
    expect(
      ticketsSchema.safeParse({ ...base, questions: q(TICKET_FORM_FIELDS), images: false }).success,
    ).toBe(true);
    expect(
      ticketsSchema.safeParse({ ...base, questions: q(TICKET_FORM_FIELDS + 1), images: false })
        .success,
    ).toBe(false);
    expect(
      ticketsSchema.safeParse({ ...base, questions: q(TICKET_FORM_FIELDS), images: true }).success,
    ).toBe(false);
    expect(
      ticketsSchema.safeParse({ ...base, questions: q(TICKET_FORM_FIELDS - 1), images: true })
        .success,
    ).toBe(true);
  });

  it("odrzuca powtórzone ID, puste nazwy, więcej niż 25 rodzajów i złą liczbę otwartych ticketów", () => {
    const base = defaultTickets();
    const first = base.positions[0]!;
    expect(ticketsSchema.safeParse({ ...base, positions: [first, first] }).success).toBe(false);
    expect(
      ticketsSchema.safeParse({ ...base, positions: [{ ...first, label: "  " }] }).success,
    ).toBe(false);
    expect(
      ticketsSchema.safeParse({
        ...base,
        positions: Array.from({ length: 26 }, (_, k) => ({ ...first, id: `p${k}` })),
      }).success,
    ).toBe(false);
    expect(ticketsSchema.safeParse({ ...base, maxOpen: 0 }).success).toBe(false);
    expect(ticketsSchema.safeParse({ ...base, maxOpen: 11 }).success).toBe(false);
    expect(
      ticketsSchema.safeParse({ ...base, positions: [{ ...first, roleId: "nie-id" }] }).success,
    ).toBe(false);
  });

  it("pełna treść z tickets przechodzi walidację i nie traci pól", () => {
    const full = {
      ...old,
      tickets: {
        ...defaultTickets(),
        images: true,
        maxOpen: 5,
        questions: defaultTickets().questions.slice(0, 2),
      },
    };
    const r = contentSchema.parse(full);
    expect(r.tickets.images).toBe(true);
    expect(r.tickets.maxOpen).toBe(5);
    expect(r.tickets.questions).toHaveLength(2);
  });
});
