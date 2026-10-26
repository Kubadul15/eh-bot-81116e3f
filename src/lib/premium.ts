// Plan Premium: model danych, limity i cennik. Współdzielone przez stronę (UI + walidacja) – bot ma lustrzaną kopię w lib/premium.js.
// Dane zapisujemy w guild_configs.settings._admin (niewidoczne dla klientów, wycinane w getGuild) – bez nowych tabel.

/** Jedyne konto Discord z dostępem do panelu administratora. */
export const OWNER_ID = "1040335356400250931";
export const OWNER_PROFILE_URL = `https://discord.com/users/${OWNER_ID}`;
export const PRICE_LIFETIME_PLN = 20;

export type Limits = {
  recruitPositions: number; // stanowiska w rekrutacji
  recruitQuestions: number; // pytania w formularzu rekrutacji – osobno dla każdego stanowiska
  citizens: number; // profile obywateli w mObywatelu
  vehicles: number; // pojazdy na obywatela
  giveaways: number; // jednocześnie trwające konkursy
  ticketTypes: number; // rodzaje ticketów w menu wyboru (select menu)
};
export const LIMIT_LABELS: Record<keyof Limits, string> = {
  recruitPositions: "Stanowiska w rekrutacji",
  recruitQuestions: "Pytania na stanowisko w rekrutacji",
  citizens: "Obywatele w mObywatelu",
  vehicles: "Pojazdy na obywatela",
  giveaways: "Jednoczesne konkursy",
  ticketTypes: "Rodzaje ticketów w menu",
};
export const FREE_LIMITS: Limits = {
  recruitPositions: 3,
  recruitQuestions: 5,
  citizens: 150,
  vehicles: 3,
  giveaways: 1,
  ticketTypes: 5,
};
export const PREMIUM_LIMITS: Limits = {
  recruitPositions: 8,
  recruitQuestions: 25,
  citizens: 100_000,
  vehicles: 10,
  giveaways: 20,
  ticketTypes: 25,
};
export const LIMIT_KEYS = Object.keys(FREE_LIMITS) as (keyof Limits)[];

/** Moduły bota, które administrator może wyłączyć na wybranym serwerze (klucze = nazwy plików modułów bota). */
export const MODULES: [id: string, label: string][] = [
  ["mobywatel", "mObywatel"],
  ["mobyadmin", "Panel administracji mObywatela"],
  ["moderation", "Moderacja (/mod)"],
  ["utility", "Narzędzia społeczności"],
  ["welcome", "Powitania i autorole"],
  ["justice", "Sąd"],
  ["lawyers", "Adwokaci, prawnicy, kuratorzy"],
  ["verify", "Weryfikacja captcha"],
  ["staff", "Administracja (plusy/minusy)"],
  ["tickets", "Tickety"],
  ["mafia", "Mafia"],
  ["firmy", "Firmy"],
  ["policja", "Policja"],
  ["poczekalnia", "Poczekalnia głosowa (Max)"],
  ["nieruchomosci", "Nieruchomości"],
  ["recruit", "Rekrutacja"],
  ["embed", "Kreator /embed"],
  ["ban", "Bany Roblox"],
];
export const MODULE_IDS = MODULES.map((m) => m[0]);

/** Funkcje, które właściciel może nadać serwerowi bez pełnego Premium (zakładka „Funkcje dodatkowe” w panelu admina). */
export const FEATURE_GRANTS: [id: string, label: string][] = [
  ["ticketImages", "Obrazki w formularzu ticketu"],
  ["recruitSite", "Strona rekrutacyjna i panel ekipy"],
];
export const FEATURE_IDS = FEATURE_GRANTS.map((f) => f[0]);

/** Panele do wysyłki, które wymagają Premium (klucze jak w PANEL_SLOTS). */
export const PREMIUM_PANELS = [
  "sad",
  "adwokaci",
  "prawnicy",
  "kuratorzy",
  "weryfikacja",
  "mafia",
  "firmy",
  "policja",
  "nieruchomosci",
] as const;

export type Payment = {
  id: string;
  amount: number;
  at: string;
  method: string;
  note: string;
  by: string;
};
export type PremiumGrant = {
  since: string;
  until: string | null;
  by: string;
  source: "admin" | "payment" | "gift" | "bulk" | "trial";
  note: string;
};
/** Bezpłatny okres próbny Premium: raz na serwer i raz na konto Discord. */
export const TRIAL_DAYS = 3;
export type AdminMeta = {
  premium?: PremiumGrant;
  /** Plan Max: tylko na zaproszenie (nadaje go wyłącznie właściciel bota), obejmuje wszystko z Premium + funkcje Max. */
  max?: Omit<PremiumGrant, "source">;
  trial?: { at: string; until: string; by: string }; // ślad wykorzystanego triala (zostaje po jego wygaśnięciu)
  blocked?: { reason: string; at: string; by: string };
  disabled?: string[];
  features?: string[]; // funkcje nadane ręcznie (FEATURE_GRANTS), niezależnie od Premium
  limits?: Partial<Limits>;
  note?: string;
  contact?: string;
  tags?: string[];
  payments?: Payment[];
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Wyciąga blok administracyjny z settings (zawsze zwraca obiekt). */
export function metaOf(settings: unknown): AdminMeta {
  const raw = isObj(settings) ? settings["_admin"] : undefined;
  return isObj(raw) ? (raw as AdminMeta) : {};
}
const grantLive = (g: { until: string | null } | undefined, now: number): boolean =>
  !!g && (g.until === null || Date.parse(g.until) > now);
export const maxActive = (m: AdminMeta, now = Date.now()): boolean => grantLive(m.max, now);
/** Plan Max obejmuje wszystko z Premium, więc serwer z Max jest też „premium”. */
export const premiumActive = (m: AdminMeta, now = Date.now()): boolean =>
  grantLive(m.premium, now) || maxActive(m, now);
export const isLifetime = (m: AdminMeta): boolean => !!m.premium && m.premium.until === null;
export function limitsFor(m: AdminMeta, now = Date.now()): Limits {
  const base = premiumActive(m, now) ? PREMIUM_LIMITS : FREE_LIMITS;
  const out = { ...base };
  for (const k of LIMIT_KEYS) {
    const v = m.limits?.[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
  }
  return out;
}
/** Funkcja jest dostępna w Premium albo została nadana serwerowi ręcznie. */
export const hasFeature = (m: AdminMeta, id: string, now = Date.now()): boolean =>
  premiumActive(m, now) || !!m.features?.includes(id);

/**
 * Czy serwer może uruchomić trial: tylko gdy nigdy nie miał Premium (ani płatnego, ani nadanego) i nie wykorzystał triala.
 * `usedByUser` = to konto Discord uruchomiło już trial na innym serwerze.
 */
export function trialCheck(
  m: AdminMeta,
  usedByUser = false,
  now = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  if (m.blocked) return { ok: false, reason: "Ten serwer jest zablokowany." };
  if (premiumActive(m, now))
    return { ok: false, reason: "Ten serwer ma już aktywny plan Premium." };
  if (m.trial) return { ok: false, reason: "Trial na tym serwerze został już wykorzystany." };
  if (m.premium)
    return {
      ok: false,
      reason: "Ten serwer miał już Premium – okres próbny dotyczy tylko nowych serwerów.",
    };
  if (usedByUser)
    return { ok: false, reason: "To konto Discord wykorzystało już trial na innym serwerze." };
  return { ok: true };
}
/** Stan triala do pokazania w panelu. */
export function trialStatus(m: AdminMeta, now = Date.now()) {
  const active = premiumActive(m, now) && m.premium?.source === "trial";
  return {
    days: TRIAL_DAYS,
    available: trialCheck(m, false, now).ok,
    active,
    used: !!m.trial,
    until: m.trial?.until ?? null,
    daysLeft:
      active && m.premium?.until
        ? Math.max(0, Math.ceil((Date.parse(m.premium.until) - now) / 86_400_000))
        : 0,
  };
}

/** Co wolno pokazać klientowi: bez notatek, płatności i danych kontaktowych. */
export function publicPremium(m: AdminMeta, now = Date.now()) {
  return {
    trial: trialStatus(m, now),
    active: premiumActive(m, now),
    max: maxActive(m, now),
    lifetime: isLifetime(m),
    until: m.premium?.until ?? null,
    blocked: m.blocked ? { reason: m.blocked.reason } : null,
    limits: limitsFor(m, now),
    ticketImages: hasFeature(m, "ticketImages", now),
    recruitSite: hasFeature(m, "recruitSite", now),
  };
}
export type PublicPremium = ReturnType<typeof publicPremium>;
/** Zachowuje blok `_admin` przy zapisie ustawień klienta (nadpisywanie settings nie może go zgubić). */
export const keepAdmin = (
  existingSettings: unknown,
  next: Record<string, unknown>,
): Record<string, unknown> =>
  isObj(existingSettings) && "_admin" in existingSettings
    ? { ...next, _admin: existingSettings["_admin"] }
    : next;

/** Nowy stan Max po nadaniu (jak grantPremium, ale na polu `max`). */
export function grantMax(
  m: AdminMeta,
  opts: { days: number | null; by: string; note?: string },
  now = Date.now(),
): NonNullable<AdminMeta["max"]> {
  const since = m.max?.since ?? new Date(now).toISOString();
  const note = opts.note ?? "";
  if (opts.days === null) return { since, until: null, by: opts.by, note };
  const start = m.max?.until && Date.parse(m.max.until) > now ? Date.parse(m.max.until) : now;
  return {
    since,
    until: new Date(start + opts.days * 86_400_000).toISOString(),
    by: opts.by,
    note,
  };
}

/** Nowy stan Premium po nadaniu: lifetime (days = null) albo na X dni (od teraz lub od końca bieżącego okresu). */
export function grantPremium(
  m: AdminMeta,
  opts: { days: number | null; by: string; source: PremiumGrant["source"]; note?: string },
  now = Date.now(),
): PremiumGrant {
  const since = m.premium?.since ?? new Date(now).toISOString();
  if (opts.days === null)
    return { since, until: null, by: opts.by, source: opts.source, note: opts.note ?? "" };
  const start =
    m.premium && m.premium.until && Date.parse(m.premium.until) > now
      ? Date.parse(m.premium.until)
      : now;
  return {
    since,
    until: new Date(start + opts.days * 86_400_000).toISOString(),
    by: opts.by,
    source: opts.source,
    note: opts.note ?? "",
  };
}

// ---------- cennik ----------
export type Row = {
  group: string;
  label: string;
  free: string | boolean;
  premium: string | boolean;
  /** Plan Max (na zaproszenie); gdy nie podano, Max ma to samo co Premium. */
  max?: string | boolean;
};
export const COMPARISON: Row[] = [
  {
    group: "mObywatel",
    label: "Dowody, prawa jazdy, licencje, pojazdy, wnioski",
    free: true,
    premium: true,
  },
  {
    group: "mObywatel",
    label: "Obywateli na serwerze",
    free: String(FREE_LIMITS.citizens),
    premium: "bez limitu",
  },
  {
    group: "mObywatel",
    label: "Pojazdy na obywatela",
    free: String(FREE_LIMITS.vehicles),
    premium: String(PREMIUM_LIMITS.vehicles),
  },
  {
    group: "mObywatel",
    label: "Panel administracji: kartoteka, zawieszenia, mandaty, log",
    free: false,
    premium: true,
  },
  {
    group: "Wymiar sprawiedliwości",
    label: "Sąd, sędziowie, prokuratorzy, wyroki ze skutkami",
    free: false,
    premium: true,
  },
  {
    group: "Wymiar sprawiedliwości",
    label: "Adwokaci, prawnicy, rachunki, pisma procesowe",
    free: false,
    premium: true,
  },
  {
    group: "Wymiar sprawiedliwości",
    label: "Kuratorzy i dozór z meldunkami",
    free: false,
    premium: true,
  },
  {
    group: "Tickety",
    label: "Rodzaje ticketów w menu wyboru",
    free: String(FREE_LIMITS.ticketTypes),
    premium: String(PREMIUM_LIMITS.ticketTypes),
  },
  {
    group: "Tickety",
    label: "Pełna edycja ticketów: rodzaje, pytania, rangi obsługi",
    free: true,
    premium: true,
  },
  {
    group: "Tickety",
    label: "Obrazki i zrzuty ekranu w formularzu ticketu",
    free: false,
    premium: true,
  },
  {
    group: "Rekrutacja",
    label: "Stanowiska w rekrutacji",
    free: String(FREE_LIMITS.recruitPositions),
    premium: String(PREMIUM_LIMITS.recruitPositions),
  },
  {
    group: "Rekrutacja",
    label: "Pytania na każde stanowisko",
    free: String(FREE_LIMITS.recruitQuestions),
    premium: String(PREMIUM_LIMITS.recruitQuestions),
  },
  {
    group: "Rekrutacja",
    label: "Własna strona rekrutacyjna z formularzem w Twoich kolorach",
    free: false,
    premium: true,
  },
  {
    group: "Rekrutacja",
    label: "Panel ekipy: podania, decyzje, rangi i uprawnienia dla rekruterów",
    free: false,
    premium: true,
  },
  {
    group: "Mafia i firmy",
    label:
      "Mafia: organizacje, hierarchia rang, punkty organizacji, operacje, rejony, sojusze i wojny",
    free: false,
    premium: true,
  },
  {
    group: "Mafia i firmy",
    label: "Firmy graczy: zatrudnianie, zmiany w pracy, punkty firmy, rozwój i ranking",
    free: false,
    premium: true,
  },
  {
    group: "Policja",
    label:
      "Policja: taryfikator, mandaty z punktami karnymi, zatrzymania z kaucją, poszukiwani, zgłoszenia 112, raporty i ranking",
    free: false,
    premium: true,
  },
  {
    group: "Nieruchomości",
    label:
      "Nieruchomości: aukcje mieszkań ze zdjęciem, licytacja z auto-podbijaniem, kup teraz, własność i odsprzedaż",
    free: false,
    premium: true,
  },
  {
    group: "Plan Max (na zaproszenie)",
    label:
      "Poczekalnia głosowa: bot gra Twój dźwięk w pętli na kanale głosowym, gdy ktoś na nim jest",
    free: false,
    premium: false,
    max: true,
  },
  {
    group: "Bezpieczeństwo",
    label: "Weryfikacja captcha dla nowych osób",
    free: false,
    premium: true,
  },
  {
    group: "Nieruchomości",
    label:
      "Nieruchomości: aukcje mieszkań ze zdjęciem, licytacja z auto-podbijaniem, kup teraz, własność i odsprzedaż",
    free: false,
    premium: true,
  },
  {
    group: "Bezpieczeństwo",
    label: "Moderacja: ostrzeżenia, wyciszenia, bany, logi",
    free: true,
    premium: true,
  },
  {
    group: "Wygląd",
    label: "Własne kolory, obrazki i stopki wiadomości bota",
    free: false,
    premium: true,
  },
  {
    group: "Wygląd",
    label: "Kreator wiadomości: do 3 embedów i webhook (własna nazwa i avatar)",
    free: "1 embed, jako bot",
    premium: true,
  },
  {
    group: "Społeczność",
    label: "Poziomy XP, ankiety, sugestie, zgłoszenia, zabawy",
    free: true,
    premium: true,
  },
  {
    group: "Społeczność",
    label: "Jednoczesne konkursy",
    free: String(FREE_LIMITS.giveaways),
    premium: String(PREMIUM_LIMITS.giveaways),
  },
  {
    group: "Inne",
    label: "Tickety, bany Roblox, panel administracji ekipy",
    free: true,
    premium: true,
  },
  {
    group: "Inne",
    label: "Wsparcie od właściciela na Discordzie",
    free: "społeczność",
    premium: "priorytetowe",
  },
];

/** Cena po rabacie procentowym (zaokrąglona w górę do pełnych groszy). */
export const priceWithDiscount = (percent: number): number =>
  Math.max(0, Math.ceil(PRICE_LIFETIME_PLN * (100 - Math.min(100, Math.max(0, percent)))) / 100);
