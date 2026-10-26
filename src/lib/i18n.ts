// Wielojęzyczność strony. Teksty w kodzie są po polsku (to jest „klucz”), a słowniki tłumaczą je na inne języki.
// ZMIANA JĘZYKA DOMYŚLNEGO: wystarczy zmienić DEFAULT_LANG poniżej (np. na "pl"). Nowy język = dopisz go do LANGS i dodaj słownik w DICTS.
import { en } from "./i18n-en";

export const LANGS = { en: "English", pl: "Polski" } as const;
export type Lang = keyof typeof LANGS;
/** Język, który widzi każdy, kto nie wybrał własnego. */
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "ehb_lang";

/** Słowniki: klucz = polski tekst z kodu. Polski nie potrzebuje słownika (tekst z kodu jest już polski). */
const DICTS: Record<Lang, Record<string, string>> = { en, pl: {} };

export const isLang = (v: unknown): v is Lang => typeof v === "string" && v in LANGS;
export const normLang = (v: unknown): Lang => (isLang(v) ? v : DEFAULT_LANG);
/** Kod języka do formatowania dat i liczb (Intl). */
export const LOCALES: Record<Lang, string> = { en: "en-GB", pl: "pl-PL" };

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export type Params = Record<string, string | number>;
const fill = (s: string, p?: Params) =>
  p ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in p ? String(p[k]) : m)) : s;

// Komunikaty z serwera przychodzą już z wstawionymi wartościami (np. „Wiek musi mieścić się w przedziale 13–99.”), więc szukamy wzorców:
// klucze z {parametrami} zamieniamy na wyrażenia regularne i dopasowujemy do gotowego tekstu.
type Pattern = { re: RegExp; names: string[]; out: string };
const patternCache = new Map<Lang, Pattern[]>();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function patternsOf(lang: Lang): Pattern[] {
  let list = patternCache.get(lang);
  if (list) return list;
  list = [];
  for (const [key, out] of Object.entries(DICTS[lang] ?? {})) {
    if (!/\{\w+\}/.test(key) || !/\p{L}{3}/u.test(key.replace(/\{\w+\}/g, ""))) continue;
    const names: string[] = [];
    const src = key
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (!m) return escapeRe(part);
        names.push(m[1] ?? "");
        return "(.+?)";
      })
      .join("");
    list.push({ re: new RegExp(`^${src}$`), names, out });
  }
  patternCache.set(lang, list);
  return list;
}

/** Tłumaczy tekst (z polskiego klucza) na wybrany język; brak tłumaczenia = oryginał. Wstawia {parametry}. */
export function translate(lang: Lang, key: string, params?: Params): string {
  const k = norm(key);
  const direct = DICTS[lang]?.[k];
  if (direct !== undefined) return fill(direct, params);
  if (lang !== "pl") {
    for (const p of patternsOf(lang)) {
      const m = p.re.exec(k);
      if (m)
        return fill(p.out, {
          ...Object.fromEntries(p.names.map((n, i) => [n, m[i + 1] ?? ""])),
          ...params,
        });
    }
  }
  return fill(k, params);
}
/** Czy dla tego klucza jest tłumaczenie (testy pokrycia). */
export const hasTranslation = (lang: Lang, key: string): boolean =>
  lang === "pl" || norm(key) in (DICTS[lang] ?? {});

/** Odczyt języka z nagłówka Cookie (serwer) albo z document.cookie (przeglądarka). */
export function langFromCookie(cookie: string | null | undefined): Lang {
  const m = new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]+)`).exec(cookie ?? "");
  return normLang(m?.[1]);
}
/** Tłumacz do funkcji `head` tras (meta tagi): `head: ({ match }) => { const L = headL(match); … L("Polski tytuł") }`. */
export const headL =
  (match: { context?: { lang?: unknown } }) =>
  (key: string, params?: Params): string =>
    translate(normLang(match.context?.lang), key, params);
