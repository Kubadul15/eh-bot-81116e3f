import { describe, expect, it } from "vitest";
import {
  activeNotice,
  cleanLimits,
  cleanTags,
  codeUsable,
  generateCode,
  normalizeCode,
  parseIds,
  permissionReport,
  premiumCsvRow,
  PREMIUM_CSV_HEADER,
  revenue,
  toCsv,
  validateBackup,
} from "@/lib/admin-logic";
import type { DiscountCode, ServerRow } from "@/lib/admin-types";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const row = (o: Partial<ServerRow> = {}): ServerRow => ({
  id: "1562833250416721980",
  name: "Nova era rp",
  icon: null,
  botIn: true,
  configured: true,
  premium: { active: true, lifetime: true, until: null, max: false },
  blocked: null,
  disabled: 0,
  note: "",
  tags: [],
  updatedAt: null,
  updatedBy: null,
  ...o,
});

describe("parseIds", () => {
  it("wyciąga unikalne ID z dowolnego tekstu", () => {
    const t =
      "1477015035363725596, 1488999134047240325\n1477015035363725596;xxx 1508455851445456998 123";
    expect(parseIds(t)).toEqual([
      "1477015035363725596",
      "1488999134047240325",
      "1508455851445456998",
    ]);
  });
  it("limit liczby i puste wejście", () => {
    expect(parseIds("", 5)).toEqual([]);
    expect(parseIds("1477015035363725596 1488999134047240325 1508455851445456998", 2)).toHaveLength(
      2,
    );
  });
});

describe("kody rabatowe", () => {
  it("generuje poprawny, losowy i bez mylących znaków kod", () => {
    const a = generateCode(),
      b = generateCode();
    expect(a).toMatch(/^EHB-[A-HJKMNP-Z2-9]{8}$/);
    expect(a).not.toBe(b);
  });
  it("normalizuje wpisany kod", () => {
    expect(normalizeCode(" ehb-ab12 cd! ")).toBe("EHB-AB12CD");
  });
  it("sprawdza ważność i limit użyć", () => {
    const base: DiscountCode = {
      code: "X",
      percent: 10,
      maxUses: 2,
      used: 0,
      note: "",
      createdAt: "2026-10-01T00:00:00Z",
      expiresAt: null,
    };
    expect(codeUsable(base, NOW).ok).toBe(true);
    expect(codeUsable({ ...base, used: 2 }, NOW)).toEqual({
      ok: false,
      reason: "Kod został już wykorzystany",
    });
    expect(codeUsable({ ...base, maxUses: null, used: 999 }, NOW).ok).toBe(true);
    expect(codeUsable({ ...base, expiresAt: "2026-10-23T00:00:00Z" }, NOW)).toEqual({
      ok: false,
      reason: "Kod wygasł",
    });
    expect(codeUsable({ ...base, expiresAt: "2026-10-30T00:00:00Z" }, NOW).ok).toBe(true);
  });
});

describe("CSV", () => {
  it("escapuje cudzysłowy, średniki i nowe linie", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ["x;y", 'z"q'],
          ["l1\nl2", 5],
        ],
      ),
    ).toBe('a;b\r\n"x;y";"z""q"\r\n"l1\nl2";5');
  });
  it("neutralizuje formuły arkusza (CSV injection)", () => {
    expect(toCsv(["a"], [["=SUM(A1:A9)"], ["+48 123"], ["@cmd"], ["-5"]])).toBe(
      "a\r\n'=SUM(A1:A9)\r\n'+48 123\r\n'@cmd\r\n'-5",
    );
  });
  it("wiersz klienta zawiera plan, daty, kontakt i sumę wpłat", () => {
    const cells = premiumCsvRow(row(), {
      premium: { since: "2026-09-01T10:00:00Z", until: null, by: "1", source: "payment", note: "" },
      contact: "jan#1",
      note: "BLIK",
      payments: [
        { id: "a", amount: 20, at: "2026-09-01T10:00:00Z", method: "BLIK", note: "", by: "1" },
        { id: "b", amount: 5, at: "2026-10-02T10:00:00Z", method: "PayPal", note: "", by: "1" },
      ],
    });
    expect(cells).toEqual([
      "1562833250416721980",
      "Nova era rp",
      "Premium lifetime",
      "2026-09-01",
      "",
      "jan#1",
      "BLIK",
      25,
      "2026-10-02",
    ]);
    expect(cells).toHaveLength(PREMIUM_CSV_HEADER.length);
  });
});

describe("przychody", () => {
  it("sumuje łącznie, w bieżącym miesiącu i buduje serię miesięczną", () => {
    const p = (amount: number, at: string) => ({
      id: at,
      amount,
      at,
      method: "",
      note: "",
      by: "",
    });
    const r = revenue(
      [
        p(20, "2026-10-03T00:00:00Z"),
        p(20, "2026-10-20T00:00:00Z"),
        p(15, "2026-09-10T00:00:00Z"),
        p(20, "2025-01-01T00:00:00Z"),
      ],
      NOW,
    );
    expect(r.total).toBe(75);
    expect(r.month).toBe(40);
    expect(r.monthly.map((m) => m.month)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(r.monthly.at(-1)?.total).toBe(40);
    expect(r.monthly.at(-2)?.total).toBe(15);
  });
  it("pomija nieprawidłowe kwoty", () => {
    expect(
      revenue(
        [{ id: "x", amount: NaN, at: "2026-10-01T00:00:00Z", method: "", note: "", by: "" }],
        NOW,
      ).total,
    ).toBe(0);
  });
});

describe("kopia zapasowa", () => {
  it("przyjmuje poprawne wiersze (z obiektem rows albo samą listą)", () => {
    const r = {
      guild_id: "1477015035363725596",
      channels: { a: "1" },
      roles: {},
      settings: {},
      content: {},
    };
    expect(validateBackup({ rows: [r] }).rows).toHaveLength(1);
    expect(validateBackup([r]).rows).toHaveLength(1);
    expect(validateBackup({ rows: [{ guild_id: "1477015035363725596" }] }).rows[0]).toMatchObject({
      channels: {},
      roles: {},
      settings: {},
      content: {},
    });
  });
  it("odrzuca złe ID, nie-obiekty i śmieci", () => {
    const v = validateBackup({
      rows: [{ guild_id: "abc" }, { guild_id: "1477015035363725596", roles: [] }, 5],
    });
    expect(v.rows).toHaveLength(0);
    expect(v.errors).toHaveLength(3);
    expect(validateBackup("tekst").errors[0]).toContain("kopii zapasowej");
    expect(validateBackup(null).rows).toEqual([]);
  });
});

describe("diagnoza uprawnień", () => {
  it("Administrator ma wszystko", () => {
    expect(permissionReport(8n).every((p) => p.ok)).toBe(true);
  });
  it("wskazuje brakujące uprawnienia", () => {
    const rep = permissionReport((1n << 10n) | (1n << 11n));
    const by = Object.fromEntries(rep.map((p) => [p.name, p.ok]));
    expect(by["Wysyłanie wiadomości"]).toBe(true);
    expect(by["Zarządzanie rolami"]).toBe(false);
    expect(by["Moderowanie członków (wyciszanie)"]).toBe(false);
  });
  it("rozpoznaje uprawnienie powyżej 32 bitów (Moderate Members)", () => {
    expect(permissionReport(1n << 40n).find((p) => p.name.startsWith("Moderowanie"))?.ok).toBe(
      true,
    );
  });
});

describe("walidacja pól admina", () => {
  it("czyści tagi i limity", () => {
    expect(cleanTags([" VIP ", "vip", "x".repeat(40), 5, ""])).toEqual([
      "vip",
      "x".repeat(24),
      "5",
    ]);
    expect(cleanTags("nie tablica")).toEqual([]);
    expect(
      cleanLimits({
        recruitPositions: 12.7,
        shopItems: -1,
        citizens: "x",
        vehicles: 2e9,
        nieznany: 5,
      }),
    ).toEqual({ recruitPositions: 12 });
  });
  it("ogłoszenie wygasa", () => {
    const n = {
      text: "x",
      level: "info" as const,
      until: "2026-10-25T00:00:00Z",
      at: "2026-10-24T00:00:00Z",
    };
    expect(activeNotice(n, NOW)).toBe(n);
    expect(activeNotice(n, Date.parse("2026-10-26T00:00:00Z"))).toBeNull();
    expect(activeNotice({ ...n, until: null }, NOW + 1e12)).not.toBeNull();
    expect(activeNotice(null, NOW)).toBeNull();
  });
});
