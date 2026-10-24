import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OWNER_ID, OWNER_PROFILE_URL } from "@/lib/premium";

const SRC = join(process.cwd(), "src");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const read = (p: string) => readFileSync(p, "utf8");

describe("panel administratora: bezpieczeństwo", () => {
  it("dostęp ma dokładnie jedno konto Discord – właściciel", () => {
    expect(OWNER_ID).toBe("1040335356400250931");
    expect(OWNER_PROFILE_URL).toBe("https://discord.com/users/1040335356400250931");
  });

  it("każda funkcja admina w admin.functions.ts sprawdza właściciela (requireOwner)", () => {
    const src = read(join(SRC, "lib/admin.functions.ts"));
    const adminPart = src.slice(0, src.indexOf("PUBLICZNE (bez logowania)"));
    const exports = [...adminPart.matchAll(/export const (admin\w+) = createServerFn/g)].map(
      (m) => m[1]!,
    );
    expect(exports.length).toBeGreaterThanOrEqual(30); // „min. 30 funkcji administratora”
    for (const name of exports) {
      const start = adminPart.indexOf(`export const ${name} =`);
      const next = adminPart.indexOf("export const ", start + 10);
      const body = adminPart.slice(start, next === -1 ? undefined : next);
      expect(body, `${name} musi wołać requireOwner`).toMatch(/requireOwner\(\)/);
    }
  });

  it("jedyne publiczne funkcje to powiadomienia, sprawdzenie kodu i zapis kliknięcia", () => {
    const src = read(join(SRC, "lib/admin.functions.ts"));
    const pub = src.slice(src.indexOf("PUBLICZNE (bez logowania)"));
    expect([...pub.matchAll(/export const (\w+) = createServerFn/g)].map((m) => m[1])).toEqual([
      "getPublicNotice",
      "checkDiscountCode",
      "trackBuyClick",
    ]);
  });

  it("kod serwerowy nie jest importowany statycznie w kodzie, który trafia do przeglądarki", () => {
    const offenders: string[] = [];
    for (const f of walk(SRC)) {
      if (
        !/\.(ts|tsx)$/.test(f) ||
        /\.server\.ts$/.test(f) ||
        /[\\/]test[\\/]/.test(f) ||
        /routeTree\.gen/.test(f)
      )
        continue;
      const src = read(f);
      // statyczne importy (ze średnikiem po cudzysłowie) modułów serwerowych; dynamiczne `await import(...)` są dozwolone
      if (
        /^\s*import[^;\n]*from\s+["'](?:\.{1,2}\/|@\/)[^"']*(?:admin\.server|client\.server|discord\.server)["']/m.test(
          src,
        )
      )
        offenders.push(f.replace(SRC, ""));
    }
    expect(offenders).toEqual([]);
  });

  it("tokeny sesji nigdy nie trafiają do odpowiedzi listy sesji", () => {
    const src = read(join(SRC, "lib/admin.server.ts"));
    const fn = src.slice(
      src.indexOf("export async function listSessions"),
      src.indexOf("export async function backupAll"),
    );
    expect(fn).not.toContain("access_token");
  });

  it("klient nie dostaje bloku _admin (notatki, płatności) w odpowiedzi getGuild", () => {
    const src = read(join(SRC, "lib/dashboard.functions.ts"));
    const fn = src.slice(
      src.indexOf("export const getGuild"),
      src.indexOf("async function assertWritable"),
    );
    expect(fn).toContain('!k.startsWith("_")');
    expect(fn).toContain("publicPremium(");
    expect(fn).not.toMatch(/settings:\s*\(cfg\?\.settings/);
  });

  it("zapis ustawień klienta zachowuje blok _admin", () => {
    expect(read(join(SRC, "lib/dashboard.functions.ts"))).toContain(
      "keepAdmin(existing, data.settings)",
    );
  });

  it("strona /admin pokazuje nie-właścicielowi 404, a nie panel", () => {
    const src = read(join(SRC, "routes/admin.tsx"));
    expect(src).toContain("!me.data.isOwner");
    expect(src).toContain("404");
    expect(src).toContain('name: "robots"');
  });
});
