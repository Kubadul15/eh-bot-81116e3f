// Shared between dashboard UI and server validation. Keys must match bot's lib/channels.js keys.
export type ChannelSlot = [key: string, emoji: string, label: string, desc: string];
export const CHANNEL_SECTIONS: { id: string; name: string; slots: ChannelSlot[] }[] = [
  { id: "urzad", name: "🏛️ Urząd", slots: [
    ["panel", "🏛️", "Panel Urzędu", "Tu trafia przycisk „Otwórz Urząd” (i „Panel administracji”)"],
    ["dowody", "🪪", "Dowody osobiste", "Ogłoszenia o wydanych dowodach"],
    ["pojazdy", "🚘", "Pojazdy", "Ogłoszenia o zarejestrowanych pojazdach"],
    ["prawa", "🚗", "Prawa jazdy", "Ogłoszenia o wydanych prawach jazdy"],
    ["bron", "🔫", "Licencje na broń", "Ogłoszenia o wydanych licencjach"],
    ["mobyapp", "📥", "Wnioski urzędowe", "Tu lądują wnioski o prawo jazdy i broń (z przyciskami Zatwierdź/Odrzuć)"],
    ["mobylog", "📜", "Logi mObywatela", "Każda akcja z panelu administracji mObywatela"],
  ] },
  { id: "admin", name: "🛡️ Administracja", slots: [
    ["opiniepanel", "💬", "Panel pochwał i skarg", "Publiczny panel – gracze piszą pochwały i skargi na ekipę"],
    ["staffpanel", "🛡️", "Panel administracji", "Panel ekipy: urlopy, awanse, odwołania"],
    ["opinie", "📥", "Pochwały i skargi (log)", "Gdzie trafiają zgłoszenia – tylko zarząd"],
    ["plusy", "➕", "Plusy i minusy (log)", "Wpisy o plusach i minusach"],
    ["awanse", "📈", "Awanse i degrady (log)", "Także te automatyczne"],
    ["wnioski", "📬", "Wszystkie wnioski", "Domyślny kanał na wnioski ekipy"],
    ["wnioski_awans", "⭐", "Wnioski o awans", "Osobny kanał (opcjonalnie)"],
    ["urlopy", "🏖️", "Wnioski urlopowe", "Osobny kanał (opcjonalnie)"],
    ["odwolania", "📨", "Odwołania", "Odwołania od minusów i degradów"],
  ] },
  { id: "tickety", name: "🎫 Tickety", slots: [
    ["ticketpanel", "🎫", "Panel ticketów", "Menu wyboru kategorii zgłoszenia"],
    ["ticketcat", "🗂️", "Kategoria ticketów", "KATEGORIA (folder), w której powstają kanały ticketów"],
    ["ticketlog", "📄", "Logi ticketów", "Otwarcia, zamknięcia i transkrypty"],
  ] },
  { id: "rekrutacja", name: "📝 Rekrutacja", slots: [
    ["rekrutpanel", "📝", "Panel rekrutacji", "Publiczny panel naboru ze stanowiskami"],
    ["rekrutacja", "📋", "Aplikacje rekrutacyjne", "Tu trafiają wypełnione formularze – tylko dla ekipy"],
  ] },
  { id: "weryfikacja", name: "🔐 Weryfikacja", slots: [
    ["weryfpanel", "🔐", "Panel weryfikacji", "Przycisk z kodem captcha dla nowych osób"],
  ] },
  { id: "bany", name: "🔨 Bany", slots: [["ban", "🔨", "Kanał banów", "Tu trafiają wystawione bany"]] },
];
export const CHANNEL_KEYS = CHANNEL_SECTIONS.flatMap((s) => s.slots.map((x) => x[0]));

// Panele, które można wysłać ze strony. slot = klucz kanału z CHANNEL_SECTIONS, key musi pasować do bota (modules/panels.js).
export const PANEL_SLOTS = [
  { key: "urzad", emoji: "🏛️", label: "Urząd (mObywatel)", slot: "panel" },
  { key: "opinie", emoji: "💬", label: "Pochwały i skargi", slot: "opiniepanel" },
  { key: "staff", emoji: "🛡️", label: "Panel administracji", slot: "staffpanel" },
  { key: "tickety", emoji: "🎫", label: "Tickety", slot: "ticketpanel" },
  { key: "rekrutacja", emoji: "📝", label: "Rekrutacja", slot: "rekrutpanel" },
  { key: "weryfikacja", emoji: "🔐", label: "Weryfikacja (captcha)", slot: "weryfpanel" },
] as const;
export const PANEL_KEYS = PANEL_SLOTS.map((p) => p.key);

export type RoleField = { key: string; label: string; desc: string; multi: boolean; ordered?: boolean };
export const ROLE_FIELDS: RoleField[] = [
  { key: "staff", label: "Administracja", desc: "Cała ekipa – dostęp do panelu administracji i wniosków", multi: true },
  { key: "management", label: "Zarząd", desc: "Plusy, minusy, awanse, skargi i urlopy", multi: true },
  { key: "ranks", label: "Drabinka rang", desc: "Kliknij od NAJNIŻSZEJ do NAJWYŻSZEJ – kolejność ma znaczenie", multi: true, ordered: true },
  { key: "leave", label: "Ranga urlopowa", desc: "Nadawana na czas urlopu", multi: false },
  { key: "ban", label: "Mogą banować", desc: "Dostęp do komendy /ban", multi: true },
  { key: "police", label: "Policja / służby", desc: "Dostęp do komendy /kontrola", multi: true },
  { key: "moby_admin", label: "Administracja mObywatela", desc: "Kto może kliknąć „Panel administracji” w Urzędzie. Bez wyboru – cała ekipa", multi: true },
  { key: "verified", label: "Rangi po weryfikacji", desc: "Nadawane po poprawnym kodzie captcha – możesz wybrać kilka", multi: true },
  { key: "unverified", label: "Rangi przed weryfikacją", desc: "Zdejmowane po weryfikacji (opcjonalnie, też kilka)", multi: true },
];

export const NUM_FIELDS = [
  { key: "minus_limit", label: "Minusy do auto-degradu", def: 3 },
  { key: "plus_promo", label: "Plusy do auto-awansu", def: 3 },
  { key: "appeal_days", label: "Dni na odwołanie", def: 7 },
  { key: "max_leave_days", label: "Maks. dni urlopu", def: 30 },
] as const;

// Kategorie widoczne w panelu: co do czego należy. sections = id z CHANNEL_SECTIONS.
export type Category = {
  id: string; emoji: string; label: string; desc: string;
  sections: string[]; roles: string[]; nums: string[]; panels: string[]; recruitment?: boolean;
};
export const CATEGORIES: Category[] = [
  { id: "urzad", emoji: "🏛️", label: "Urząd", desc: "mObywatel: dowody, prawa jazdy, licencje, pojazdy i panel administracji", sections: ["urzad"], roles: ["moby_admin", "police"], nums: [], panels: ["urzad"] },
  { id: "admin", emoji: "🛡️", label: "Administracja", desc: "Ekipa: urlopy, awanse, plusy/minusy, pochwały i skargi", sections: ["admin"], roles: ["staff", "management", "ranks", "leave"], nums: ["minus_limit", "plus_promo", "appeal_days", "max_leave_days"], panels: ["opinie", "staff"] },
  { id: "tickety", emoji: "🎫", label: "Tickety", desc: "Zgłoszenia graczy w prywatnych kanałach", sections: ["tickety"], roles: [], nums: [], panels: ["tickety"] },
  { id: "rekrutacja", emoji: "📝", label: "Rekrutacja", desc: "Nabór: stanowiska, formularz i aplikacje", sections: ["rekrutacja"], roles: [], nums: [], panels: ["rekrutacja"], recruitment: true },
  { id: "weryfikacja", emoji: "🔐", label: "Weryfikacja", desc: "Captcha dla nowych osób i nadawanie rang", sections: ["weryfikacja"], roles: ["verified", "unverified"], nums: [], panels: ["weryfikacja"] },
  { id: "bany", emoji: "🔨", label: "Bany", desc: "Kto może banować i gdzie trafiają bany", sections: ["bany"], roles: ["ban"], nums: [], panels: [] },
];

export const isSnowflake = (v: unknown): v is string => typeof v === "string" && /^\d{17,20}$/.test(v);
