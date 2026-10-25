import { describe, expect, it } from "vitest";
import {
  TRIAL_DAYS,
  limitsFor,
  premiumActive,
  publicPremium,
  trialCheck,
  trialStatus,
  type AdminMeta,
} from "@/lib/premium";

const NOW = Date.parse("2026-10-25T12:00:00Z");
const day = 86_400_000;
const trialMeta = (daysAgo: number): AdminMeta => {
  const start = NOW - daysAgo * day;
  const until = new Date(start + TRIAL_DAYS * day).toISOString();
  return {
    premium: { since: new Date(start).toISOString(), until, by: "1", source: "trial", note: "" },
    trial: { at: new Date(start).toISOString(), until, by: "1" },
  };
};

describe("trial Premium (3 dni za darmo)", () => {
  it("trwa 3 dni", () => {
    expect(TRIAL_DAYS).toBe(3);
  });

  it("nowy serwer może uruchomić trial", () => {
    expect(trialCheck({}, false, NOW)).toEqual({ ok: true });
    expect(trialStatus({}, NOW)).toMatchObject({
      available: true,
      active: false,
      used: false,
      days: 3,
    });
  });

  it("tylko raz na serwer", () => {
    const r = trialCheck(trialMeta(10), false, NOW); // trial sprzed 10 dni, już wygasł
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/wykorzystany/);
    expect(trialStatus(trialMeta(10), NOW)).toMatchObject({
      available: false,
      used: true,
      active: false,
    });
  });

  it("tylko raz na konto Discord (też na innym serwerze)", () => {
    const r = trialCheck({}, true, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/konto Discord/);
  });

  it("serwer z aktywnym Premium albo z historią Premium nie dostaje triala", () => {
    const paid: AdminMeta = {
      premium: { since: "", until: null, by: "1", source: "payment", note: "" },
    };
    expect(trialCheck(paid, false, NOW).ok).toBe(false);
    const expired: AdminMeta = {
      premium: {
        since: "",
        until: new Date(NOW - day).toISOString(),
        by: "1",
        source: "gift",
        note: "",
      },
    };
    expect(premiumActive(expired, NOW)).toBe(false);
    const r = trialCheck(expired, false, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/miał już Premium/);
  });

  it("serwer zablokowany nie dostaje triala", () => {
    expect(trialCheck({ blocked: { reason: "x", at: "", by: "" } }, false, NOW).ok).toBe(false);
  });

  it("w trakcie triala Premium jest aktywne z pełnymi limitami i licznikiem dni", () => {
    const m = trialMeta(1);
    expect(premiumActive(m, NOW)).toBe(true);
    expect(limitsFor(m, NOW).recruitQuestions).toBe(25);
    const p = publicPremium(m, NOW);
    expect(p.active).toBe(true);
    expect(p.lifetime).toBe(false);
    expect(p.recruitSite).toBe(true);
    expect(p.trial).toMatchObject({ active: true, available: false, used: true, daysLeft: 2 });
  });

  it("po 3 dniach serwer wraca do planu Free, a trial zostaje oznaczony jako wykorzystany", () => {
    const m = trialMeta(3.5);
    expect(premiumActive(m, NOW)).toBe(false);
    expect(limitsFor(m, NOW).recruitQuestions).toBe(5);
    const p = publicPremium(m, NOW);
    expect(p.active).toBe(false);
    expect(p.recruitSite).toBe(false);
    expect(p.trial).toMatchObject({ active: false, available: false, used: true, daysLeft: 0 });
  });

  it("ostatni dzień pokazuje 1 dzień, a nie 0", () => {
    const m = trialMeta(2.5);
    expect(publicPremium(m, NOW).trial.daysLeft).toBe(1);
  });

  it("publiczny stan nie ujawnia, kto uruchomił trial", () => {
    expect(JSON.stringify(publicPremium(trialMeta(1), NOW))).not.toContain('"by"');
  });
});
