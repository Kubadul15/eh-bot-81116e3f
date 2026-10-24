// Czysta logika panelu administratora (bez dostępu do bazy i Discorda) – łatwa do przetestowania.
import { LIMIT_KEYS, type AdminMeta, type Limits, type Payment } from "./premium";
import type { DiscountCode, Notice, ServerRow } from "./admin-types";
import { isSnowflake } from "./bot-slots";
import type { Json } from "@/integrations/supabase/types";

/** Wyciąga unikalne ID serwerów (17–20 cyfr) z dowolnego tekstu: spacje, przecinki, nowe linie. */
export function parseIds(text: string, max = 200): string[] {
  const found = String(text ?? "").match(/\d{17,20}/g) ?? [];
  return [...new Set(found)].slice(0, max);
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // bez 0/O, 1/I/L
/** Losowy kod rabatowy, np. EHB-7K2M9QXA (kryptograficznie losowy). */
export function generateCode(len = 8): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return `EHB-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}
export const normalizeCode = (s: string): string =>
  String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 32);

/** Czy kod można jeszcze użyć (limit użyć, data ważności). */
export function codeUsable(c: DiscountCode, now = Date.now()): { ok: boolean; reason?: string } {
  if (c.expiresAt && Date.parse(c.expiresAt) <= now) return { ok: false, reason: "Kod wygasł" };
  if (c.maxUses !== null && c.used >= c.maxUses)
    return { ok: false, reason: "Kod został już wykorzystany" };
  return { ok: true };
}

const csvCell = (v: unknown): string => {
  const s = String(v ?? "");
  // zabezpieczenie przed wstrzyknięciem formuł w arkuszu (=, +, -, @ na początku)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const toCsv = (header: string[], rows: unknown[][]): string =>
  [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");

/** Wiersz CSV dla klienta Premium (do księgowości). */
export function premiumCsvRow(s: ServerRow, meta: AdminMeta): unknown[] {
  const paid = (meta.payments ?? []).reduce((n, p) => n + p.amount, 0);
  const last = [...(meta.payments ?? [])].sort((a, b) => b.at.localeCompare(a.at))[0];
  return [
    s.id,
    s.name,
    s.premium.lifetime ? "Premium lifetime" : s.premium.active ? "Premium czasowy" : "Free",
    meta.premium?.since?.slice(0, 10) ?? "",
    s.premium.until?.slice(0, 10) ?? "",
    meta.contact ?? "",
    meta.note ?? "",
    paid,
    last?.at.slice(0, 10) ?? "",
  ];
}
export const PREMIUM_CSV_HEADER = [
  "ID serwera",
  "Nazwa",
  "Plan",
  "Od",
  "Do",
  "Kontakt",
  "Notatka",
  "Wpłacono (zł)",
  "Ostatnia płatność",
];

/** Przychody: suma, bieżący miesiąc i ostatnie N miesięcy (do wykresu). */
export function revenue(all: Payment[], now = Date.now(), months = 6) {
  const key = (t: number) => new Date(t).toISOString().slice(0, 7);
  const cur = key(now);
  const series: { month: string; total: number }[] = [];
  const d = new Date(now);
  for (let k = months - 1; k >= 0; k--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1));
    series.push({ month: m.toISOString().slice(0, 7), total: 0 });
  }
  let total = 0;
  for (const p of all) {
    if (!Number.isFinite(p.amount)) continue;
    total += p.amount;
    const slot = series.find((s) => s.month === p.at.slice(0, 7));
    if (slot) slot.total += p.amount;
  }
  return { total, month: series.find((s) => s.month === cur)?.total ?? 0, monthly: series };
}

// ---------- kopia zapasowa ----------
export type BackupRow = {
  guild_id: string;
  channels: Json;
  roles: Json;
  settings: Json;
  content: Json;
};
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Waliduje plik kopii zapasowej: lista wierszy z poprawnymi ID serwerów i obiektami konfiguracji. */
export function validateBackup(input: unknown): { rows: BackupRow[]; errors: string[] } {
  const errors: string[] = [];
  const list =
    isObj(input) && Array.isArray(input["rows"])
      ? (input["rows"] as unknown[])
      : Array.isArray(input)
        ? input
        : null;
  if (!list) return { rows: [], errors: ["To nie jest plik kopii zapasowej (brak listy „rows”)."] };
  const rows: BackupRow[] = [];
  list.forEach((r, i) => {
    if (!isObj(r) || !isSnowflake(r["guild_id"]))
      return void errors.push(`Wiersz ${i + 1}: zły guild_id`);
    for (const k of ["channels", "roles", "settings", "content"] as const) {
      if (r[k] !== undefined && !isObj(r[k]))
        return void errors.push(
          `Wiersz ${i + 1} (${String(r["guild_id"])}): pole „${k}” musi być obiektem`,
        );
    }
    rows.push({
      guild_id: r["guild_id"] as string,
      channels: (r["channels"] ?? {}) as Json,
      roles: (r["roles"] ?? {}) as Json,
      settings: (r["settings"] ?? {}) as Json,
      content: (r["content"] ?? {}) as Json,
    });
  });
  return { rows, errors };
}

// ---------- uprawnienia bota (diagnoza) ----------
export const BOT_PERMS: [name: string, bit: bigint][] = [
  ["Wyświetlanie kanałów", 1n << 10n],
  ["Wysyłanie wiadomości", 1n << 11n],
  ["Osadzanie linków (embedy)", 1n << 14n],
  ["Załączanie plików", 1n << 15n],
  ["Czytanie historii", 1n << 16n],
  ["Zarządzanie wiadomościami", 1n << 13n],
  ["Zarządzanie kanałami", 1n << 4n],
  ["Zarządzanie rolami", 1n << 28n],
  ["Wyrzucanie członków", 1n << 1n],
  ["Banowanie członków", 1n << 2n],
  ["Moderowanie członków (wyciszanie)", 1n << 40n],
  ["Zarządzanie webhookami", 1n << 29n],
  ["Tworzenie zaproszeń", 1n << 0n],
];
/** Raport uprawnień bota na podstawie sumy uprawnień jego rang (Administrator = wszystko). */
export function permissionReport(bits: bigint): { name: string; ok: boolean }[] {
  const admin = (bits & (1n << 3n)) !== 0n;
  return BOT_PERMS.map(([name, bit]) => ({ name, ok: admin || (bits & bit) !== 0n }));
}

// ---------- walidacja wejść ----------
export const clampText = (s: unknown, max: number): string =>
  String(s ?? "")
    .trim()
    .slice(0, max);
export const cleanTags = (v: unknown): string[] =>
  Array.isArray(v)
    ? [...new Set(v.map((t) => clampText(t, 24).toLowerCase()).filter(Boolean))].slice(0, 10)
    : [];
export function cleanLimits(v: unknown): Partial<Limits> {
  const out: Record<string, number> = {};
  if (v && typeof v === "object") {
    for (const k of LIMIT_KEYS) {
      const n = (v as Record<string, unknown>)[k];
      if (typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1_000_000)
        out[k] = Math.floor(n);
    }
  }
  return out as Partial<Limits>;
}
export const activeNotice = (n: Notice | null, now = Date.now()): Notice | null =>
  n && (!n.until || Date.parse(n.until) > now) ? n : null;
