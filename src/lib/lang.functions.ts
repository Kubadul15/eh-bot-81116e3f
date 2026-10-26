import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { LANG_COOKIE, normLang } from "./i18n";

/** Język z ciasteczka (renderowanie po stronie serwera); w przeglądarce czytamy document.cookie, żeby nie pytać serwera przy każdej nawigacji. */
export const getServerLang = createServerFn({ method: "GET" }).handler(async () =>
  normLang(getCookie(LANG_COOKIE)),
);
