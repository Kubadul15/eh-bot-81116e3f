import { describe, expect, it } from "vitest";
import {
  COMPARISON,
  FREE_LIMITS,
  PREMIUM_LIMITS,
  PRICE_LIFETIME_PLN,
  OWNER_ID,
  grantPremium,
  keepAdmin,
  limitsFor,
  metaOf,
  premiumActive,
  priceWithDiscount,
  publicPremium,
} from "@/lib/premium";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-24T12:00:00Z");

describe("premium", () => {
  it("brak danych = plan Free z limitami Free", () => {
    const m = metaOf({});
    expect(premiumActive(m, NOW)).toBe(false);
    expect(limitsFor(m, NOW)).toEqual(FREE_LIMITS);
  });

  it("lifetime jest aktywny zawsze, nawet za 100 lat", () => {
    const m = metaOf({
      _admin: {
        premium: {
          since: "2026-01-01T00:00:00Z",
          until: null,
          by: OWNER_ID,
          source: "payment",
          note: "",
        },
      },
    });
    expect(premiumActive(m, NOW)).toBe(true);
    expect(premiumActive(m, NOW + 36_500 * DAY)).toBe(true);
    expect(limitsFor(m, NOW)).toEqual(PREMIUM_LIMITS);
  });

  it("czasowy Premium wygasa", () => {
    const m = metaOf({
      _admin: {
        premium: {
          since: "2026-10-01T00:00:00Z",
          until: "2026-10-30T00:00:00Z",
          by: OWNER_ID,
          source: "gift",
          note: "",
        },
      },
    });
    expect(premiumActive(m, NOW)).toBe(true);
    expect(premiumActive(m, Date.parse("2026-10-30T00:00:01Z"))).toBe(false);
    expect(limitsFor(m, Date.parse("2026-11-05T00:00:00Z"))).toEqual(FREE_LIMITS);
  });

  it("nadpisanie limitów przez admina działa i ignoruje śmieci", () => {
    const m = metaOf({
      _admin: { limits: { recruitPositions: 10, shopItems: -1, citizens: "dużo" } },
    });
    const l = limitsFor(m, NOW);
    expect(l.recruitPositions).toBe(10);
    expect(l.shopItems).toBe(FREE_LIMITS.shopItems);
    expect(l.citizens).toBe(FREE_LIMITS.citizens);
  });

  it("metaOf znosi niepoprawne dane", () => {
    expect(metaOf(null)).toEqual({});
    expect(metaOf({ _admin: "tekst" })).toEqual({});
    expect(metaOf({ _admin: [1, 2] })).toEqual({});
  });

  it("publicPremium nie ujawnia notatek, kontaktu ani płatności", () => {
    const m = metaOf({
      _admin: {
        note: "tajne",
        contact: "x#1",
        payments: [{ id: "1", amount: 20 }],
        premium: {
          since: "2026-01-01T00:00:00Z",
          until: null,
          by: "1",
          source: "admin",
          note: "n",
        },
        blocked: { reason: "spam", at: "x", by: "y" },
      },
    });
    const json = JSON.stringify(publicPremium(m, NOW));
    expect(json).not.toContain("tajne");
    expect(json).not.toContain("x#1");
    expect(json).not.toContain("payments");
    expect(JSON.parse(json).blocked).toEqual({ reason: "spam" });
  });

  it("zapis ustawień klienta zachowuje blok _admin", () => {
    const existing = { minus_limit: 3, _admin: { premium: { until: null } } };
    expect(keepAdmin(existing, { minus_limit: 5 })).toEqual({
      minus_limit: 5,
      _admin: { premium: { until: null } },
    });
    expect(keepAdmin({ minus_limit: 3 }, { minus_limit: 5 })).toEqual({ minus_limit: 5 });
    expect(keepAdmin(null, { a: 1 })).toEqual({ a: 1 });
  });

  it("nadanie: lifetime, na dni i przedłużanie od końca bieżącego okresu", () => {
    const life = grantPremium({}, { days: null, by: OWNER_ID, source: "payment" }, NOW);
    expect(life.until).toBeNull();
    const first = grantPremium({}, { days: 30, by: OWNER_ID, source: "gift" }, NOW);
    expect(Date.parse(first.until!)).toBe(NOW + 30 * DAY);
    const ext = grantPremium(
      { premium: first },
      { days: 10, by: OWNER_ID, source: "admin" },
      NOW + 5 * DAY,
    );
    expect(Date.parse(ext.until!)).toBe(NOW + 40 * DAY);
    expect(ext.since).toBe(first.since);
    const afterExpiry = grantPremium(
      { premium: first },
      { days: 7, by: OWNER_ID, source: "admin" },
      NOW + 60 * DAY,
    );
    expect(Date.parse(afterExpiry.until!)).toBe(NOW + 67 * DAY);
  });

  it("cena i rabaty", () => {
    expect(PRICE_LIFETIME_PLN).toBe(20);
    expect(priceWithDiscount(0)).toBe(20);
    expect(priceWithDiscount(25)).toBe(15);
    expect(priceWithDiscount(100)).toBe(0);
    expect(priceWithDiscount(150)).toBe(0);
    expect(priceWithDiscount(-5)).toBe(20);
  });

  it("tabela porównania: każdy wiersz coś daje Premium i nic nie jest tylko dla Free", () => {
    for (const r of COMPARISON) {
      expect(r.premium, r.label).toBeTruthy();
      if (r.free === true) expect(r.premium, r.label).toBe(true);
    }
    expect(COMPARISON.some((r) => r.free === false)).toBe(true);
  });
});
