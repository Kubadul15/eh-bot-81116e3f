import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  CHANNEL_KEYS,
  CHANNEL_SECTIONS,
  NUM_FIELDS,
  PANEL_SLOTS,
  ROLE_FIELDS,
} from "@/lib/bot-slots";
import { BOT_PERMISSIONS } from "@/components/site";

const dupes = (a: string[]) => a.filter((x, i) => a.indexOf(x) !== i);

// Spójność kategorii panelu z kanałami, rangami i panelami, które zna bot.
describe("bot-slots", () => {
  it("klucze kanałów, rang, limitów i paneli są unikalne", () => {
    expect(dupes(CHANNEL_KEYS)).toEqual([]);
    expect(dupes(ROLE_FIELDS.map((f) => f.key))).toEqual([]);
    expect(dupes(NUM_FIELDS.map((f) => f.key))).toEqual([]);
    expect(dupes(PANEL_SLOTS.map((p) => p.key))).toEqual([]);
    expect(dupes(CATEGORIES.map((c) => c.id))).toEqual([]);
  });

  it("każda kategoria odwołuje się do istniejących sekcji, rang, limitów i paneli", () => {
    const sections = CHANNEL_SECTIONS.map((s) => s.id);
    for (const c of CATEGORIES) {
      for (const s of c.sections) expect(sections, `${c.id}: sekcja ${s}`).toContain(s);
      for (const r of c.roles)
        expect(
          ROLE_FIELDS.map((f) => f.key),
          `${c.id}: ranga ${r}`,
        ).toContain(r);
      for (const n of c.nums)
        expect(
          NUM_FIELDS.map((f) => f.key),
          `${c.id}: limit ${n}`,
        ).toContain(n);
      for (const p of c.panels)
        expect(
          PANEL_SLOTS.map((x) => x.key),
          `${c.id}: panel ${p}`,
        ).toContain(p);
    }
  });

  it("żadna ranga, limit ani panel nie jest osierocony (każdy należy do jakiejś kategorii)", () => {
    expect(
      ROLE_FIELDS.map((f) => f.key).filter((k) => !CATEGORIES.some((c) => c.roles.includes(k))),
    ).toEqual([]);
    expect(
      NUM_FIELDS.map((f) => f.key).filter((k) => !CATEGORIES.some((c) => c.nums.includes(k))),
    ).toEqual([]);
    expect(
      PANEL_SLOTS.map((p) => p.key).filter((k) => !CATEGORIES.some((c) => c.panels.includes(k))),
    ).toEqual([]);
    expect(
      CHANNEL_SECTIONS.map((s) => s.id).filter(
        (id) => !CATEGORIES.some((c) => c.sections.includes(id)),
      ),
    ).toEqual([]);
  });

  it("panele wysyłają się na istniejący kanał", () => {
    for (const p of PANEL_SLOTS) expect(CHANNEL_KEYS, `panel ${p.key}`).toContain(p.slot);
  });

  it("limity mają sensowne zakresy", () => {
    for (const f of NUM_FIELDS) {
      expect(f.def).toBeGreaterThanOrEqual(f.min ?? 1);
      expect(f.def).toBeLessThanOrEqual(f.max ?? 365);
    }
  });

  it("zaproszenie bota zawiera wyciszanie członków i zarządzanie webhookami", () => {
    const p = BigInt(BOT_PERMISSIONS);
    expect(p & (1n << 40n)).not.toBe(0n); // Moderate Members
    expect(p & (1n << 29n)).not.toBe(0n); // Manage Webhooks
    expect(p & (1n << 28n)).not.toBe(0n); // Manage Roles
  });
});
