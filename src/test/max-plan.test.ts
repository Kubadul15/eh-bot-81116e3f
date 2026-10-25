import { describe, expect, it } from "vitest";
import { grantMax, limitsFor, maxActive, premiumActive, publicPremium, PREMIUM_LIMITS, FREE_LIMITS } from "@/lib/premium";

const NOW = Date.parse("2026-06-01T00:00:00Z");
const grant = (until: string | null) => ({ since: "2026-01-01T00:00:00Z", until, by: "1", note: "" });

describe("plan Max (na zaproszenie)", () => {
  it("Max obejmuje Premium, ale Premium nie jest Max", () => {
    expect(maxActive({ max: grant(null) }, NOW)).toBe(true);
    expect(premiumActive({ max: grant(null) }, NOW)).toBe(true);
    expect(limitsFor({ max: grant(null) }, NOW)).toEqual(PREMIUM_LIMITS);
    expect(maxActive({ premium: { ...grant(null), source: "admin" } }, NOW)).toBe(false);
    expect(limitsFor({}, NOW)).toEqual(FREE_LIMITS);
  });
  it("wygasły Max nie daje niczego", () => {
    const m = { max: grant("2026-05-01T00:00:00Z") };
    expect(maxActive(m, NOW)).toBe(false);
    expect(premiumActive(m, NOW)).toBe(false);
  });
  it("publicPremium pokazuje flagę max", () => {
    expect(publicPremium({ max: grant(null) }, NOW).max).toBe(true);
    expect(publicPremium({}, NOW).max).toBe(false);
  });
  it("grantMax: lifetime, na X dni i przedłużenie od końca bieżącego okresu", () => {
    expect(grantMax({}, { days: null, by: "1" }, NOW).until).toBeNull();
    const a = grantMax({}, { days: 10, by: "1" }, NOW);
    expect(Date.parse(a.until ?? "")).toBe(NOW + 10 * 86_400_000);
    const b = grantMax({ max: a }, { days: 5, by: "1" }, NOW);
    expect(Date.parse(b.until ?? "")).toBe(NOW + 15 * 86_400_000);
    expect(b.since).toBe(a.since);
  });
});