import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { DEFAULT_LANG, LANGS, LANG_COOKIE, translate, type Lang, type Params } from "./i18n";

type Ctx = { lang: Lang; t: (key: string, params?: Params) => string };
const I18nContext = createContext<Ctx>({
  lang: DEFAULT_LANG,
  t: (key, params) => translate(DEFAULT_LANG, key, params),
});

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo<Ctx>(() => ({ lang, t: (k, p) => translate(lang, k, p) }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `const { t, lang } = useI18n();` – t("Polski tekst") zwraca tekst w języku użytkownika. */
export const useI18n = () => useContext(I18nContext);

/** Przełącznik języka: zapisuje wybór w ciasteczku (rok) i odświeża dane strony. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang } = useI18n();
  const router = useRouter();
  function pick(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    void router.invalidate();
  }
  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex overflow-hidden rounded-md border text-xs font-bold ${className}`}
    >
      {(Object.keys(LANGS) as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => pick(l)}
          aria-pressed={l === lang}
          title={LANGS[l]}
          className={`px-2 py-1 uppercase transition ${l === lang ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
