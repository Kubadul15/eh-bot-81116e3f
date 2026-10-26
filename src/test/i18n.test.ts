import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANG,
  LANGS,
  hasTranslation,
  langFromCookie,
  normLang,
  translate,
} from "@/lib/i18n";
import { en } from "@/lib/i18n-en";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (!/^(test|integrations|ui)$/.test(f)) sourceFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(f) && !/routeTree|i18n/.test(f)) out.push(p);
  }
  return out;
}

describe("i18n", () => {
  it("domyślny język to angielski i łatwo go zmienić (DEFAULT_LANG)", () => {
    expect(DEFAULT_LANG).toBe("en");
    expect(Object.keys(LANGS)).toEqual(["en", "pl"]);
    expect(normLang("xx")).toBe(DEFAULT_LANG);
    expect(normLang("pl")).toBe("pl");
  });
  it("polski zwraca tekst z kodu, angielski tłumaczenie, brak tłumaczenia = oryginał", () => {
    expect(translate("pl", "Cennik")).toBe("Cennik");
    expect(translate("en", "Cennik")).toBe("Pricing");
    expect(translate("en", "Tego nie ma w słowniku 123")).toBe("Tego nie ma w słowniku 123");
    expect(translate("en", "  Cennik \n ")).toBe("Pricing");
  });
  it("wstawia parametry", () => {
    expect(translate("en", "na serwerze {name}", { name: "Hamburg" })).toBe(
      "on the server Hamburg",
    );
    expect(translate("pl", "na serwerze {name}", { name: "Hamburg" })).toBe("na serwerze Hamburg");
  });
  it("komunikaty z serwera z już wstawionymi wartościami są dopasowywane do wzorców", () => {
    expect(translate("en", "Wiek musi mieścić się w przedziale 13–99.")).not.toBe(
      "Wiek musi mieścić się w przedziale 13–99.",
    );
    expect(translate("en", "Wiek musi mieścić się w przedziale 13–99.")).toMatch(/13.*99/);
    expect(translate("en", "Uzupełnij odpowiedź: „Nick”.")).toMatch(/Nick/);
  });
  it("czyta język z ciasteczka", () => {
    expect(langFromCookie("a=1; ehb_lang=pl; b=2")).toBe("pl");
    expect(langFromCookie("ehb_lang=en")).toBe("en");
    expect(langFromCookie("ehb_lang=de")).toBe(DEFAULT_LANG);
    expect(langFromCookie(undefined)).toBe(DEFAULT_LANG);
  });
  it("słownik: niepuste wartości i te same {parametry} co w kluczu", () => {
    for (const [k, v] of Object.entries(en)) {
      expect(v.trim(), k).not.toBe("");
      expect(ph(v), k).toBe(ph(k));
    }
  });
  it('pokrycie: każdy t("…") w kodzie ma tłumaczenie angielskie', () => {
    const re = /\b(?:t|tr|L)\(\s*("(?:[^"\\\n]|\\.)*"|`[^`$\\]*`)/g;
    const missing: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(re)) {
        const lit = m[1] ?? "";
        const key = norm(lit.startsWith("`") ? lit.slice(1, -1) : (JSON.parse(lit) as string));
        if (key && !hasTranslation("en", key))
          missing.push(`${file.split(/[\\/]src[\\/]/)[1]}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
