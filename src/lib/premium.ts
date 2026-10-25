// Plan Premium: model danych, limity i cennik. Współdzielone przez stronę (UI + walidacja) – bot ma lustrzaną kopię w lib/premium.js.
// Dane zapisujemy w guild_configs.settings._admin (niewidoczne dla klientów, wycinane w getGuild) – bez nowych tabel.

/** Jedyne konto Discord z dostępem do panelu administratora. */
export const OWNER_ID = "1040335356400250931";
export const OWNER_PROFILE_URL = `https://discord.com/users/${OWNER_ID}`;
export const PRICE_LIFETIME_PLN = 20;

export type Limits = {
  recruitPositions: number; // stanowiska w rekrutacji
  recruitQuestions: number; // pytania w formularzu rekrutacji
  shopItems: number; // przedmioty w sklepie ekonomii
  citizens: number; // profile obywateli w mObywatelu
  vehicles: number; // pojazdy na obywatela
  giveaways: number; // jednocześnie trwające konkursy
  ticketTypes: number; // rodzaje ticketów w menu wyboru (select menu)
};
export const LIMIT_LABELS: Record<keyof Limits, string> = {
  recruitPositions: "Stanowiska w rekrutacji",
  recruitQuestions: "Pytania w formularzu rekrutacji",
  shopItems: "Przedmioty w sklepie",
  citizens: "Obywatele w mObywatelu",
  vehicles: "Pojazdy na obywatela",
  giveaways: "Jednoczesne konkursy",
  ticketTypes: "Rodzaje ticketów w menu",
};
export const FREE_LIMITS: Limits = {
  recruitPositions: 3,
  recruitQuestions: 5,
  shopItems: 5,
  citizens: 150,
  vehicles: 3,
  giveaways: 1,
  ticketTypes: 5,
};
export const PREMIUM_LIMITS: Limits = {
  recruitPositions: 25,
  recruitQuestions: 15,
  shopItems: 100,
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
  ["economy", "Ekonomia"],
  ["moderation", "Moderacja (/mod)"],
  ["utility", "Narzędzia społeczności"],
  ["welcome", "Powitania i autorole"],
  ["justice", "Sąd"],
  ["lawyers", "Adwokaci, prawnicy, kuratorzy"],
  ["verify", "Weryfikacja captcha"],
  ["staff", "Administracja (plusy/minusy)"],
  ["tickets", "Tickety"],
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
export const PREMIUM_PANELS = ["sad", "adwokaci", "prawnicy", "kuratorzy", "weryfikacja"] as const;

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
  source: "admin" | "payment" | "gift" | "bulk";
  note: string;
};
export type AdminMeta = {
  premium?: PremiumGrant;
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
export const premiumActive = (m: AdminMeta, now = Date.now()): boolean =>
  !!m.premium && (m.premium.until === null || Date.parse(m.premium.until) > now);
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

/** Co wolno pokazać klientowi: bez notatek, płatności i danych kontaktowych. */
export function publicPremium(m: AdminMeta, now = Date.now()) {
  return {
    active: premiumActive(m, now),
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
    group: "Ekonomia",
    label: "Portfel, bank, praca, nagrody, pensje, ranking",
    free: true,
    premium: true,
  },
  {
    group: "Ekonomia",
    label: "Przedmioty w sklepie",
    free: String(FREE_LIMITS.shopItems),
    premium: String(PREMIUM_LIMITS.shopItems),
  },
  {
    group: "Ekonomia",
    label: "Kasyno: sloty, ruletka, blackjack, orzeł i reszka",
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
    label: "Pytania w formularzu",
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
    group: "Bezpieczeństwo",
    label: "Weryfikacja captcha dla nowych osób",
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
