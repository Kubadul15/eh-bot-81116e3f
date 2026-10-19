// Shared between dashboard UI and server validation. Keys must match bot's lib/channels.js keys.
export const CHANNEL_SECTIONS: { name: string; slots: [string, string, string, string][] }[] = [
  { name: "🏛️ Urząd", slots: [
    ["panel", "🏛️", "Panel Urzędu", "Tu trafia przycisk „Otwórz Urząd”"],
    ["dowody", "🪪", "Dowody osobiste", "Ogłoszenia wydanych dowodów"],
    ["pojazdy", "🚘", "Pojazdy", "Zarejestrowane pojazdy"],
    ["prawa", "🚗", "Prawa jazdy", "Wydane i odnowione prawa jazdy"],
    ["bron", "🔫", "Licencje na broń", "Wydane licencje na broń"],
    ["mobyapp", "📥", "Wnioski urzędowe", "Wnioski o prawo jazdy i broń"],
  ] },
  { name: "🛡️ Administracja", slots: [
    ["opiniepanel", "💬", "Panel pochwał i skarg", "Publiczny panel dla graczy"],
    ["staffpanel", "🛡️", "Panel administracji", "Urlopy, awanse, odwołania"],
    ["opinie", "📥", "Pochwały i skargi (log)", "Tylko zarząd"],
    ["plusy", "➕", "Plusy i minusy (log)", "Wpisy o plusach i minusach"],
    ["awanse", "📈", "Awanse i degrady (log)", "Też automatyczne"],
    ["wnioski", "📬", "Wszystkie wnioski", "Domyślny kanał na wnioski"],
    ["wnioski_awans", "⭐", "Wnioski o awans", "Osobny kanał (opcjonalnie)"],
    ["urlopy", "🏖️", "Wnioski urlopowe", "Osobny kanał (opcjonalnie)"],
    ["odwolania", "📨", "Odwołania", "Od minusów i degradów"],
  ] },
  { name: "🎫 Tickety i rekrutacja", slots: [
    ["ticketpanel", "🎫", "Panel ticketów", "Menu wyboru kategorii"],
    ["ticketcat", "🗂️", "Kategoria ticketów", "KATEGORIA, w której powstają tickety"],
    ["ticketlog", "📄", "Logi ticketów", "Otwarcia i transkrypty"],
    ["rekrutpanel", "📝", "Panel rekrutacji", "Publiczny panel naboru"],
    ["rekrutacja", "📋", "Aplikacje rekrutacyjne", "Dla ekipy"],
  ] },
  { name: "🔨 Pozostałe", slots: [["ban", "🔨", "Bany", "Kanał z wystawionymi banami"]] },
];
export const CHANNEL_KEYS = CHANNEL_SECTIONS.flatMap((s) => s.slots.map((x) => x[0]));

export const ROLE_FIELDS = [
  { key: "staff", label: "Administracja", desc: "Cała ekipa – panel administracji", multi: true },
  { key: "ban", label: "Mogą banować", desc: "Dostęp do /ban", multi: true },
  { key: "police", label: "Policja / służby", desc: "Dostęp do /kontrola", multi: true },
  { key: "management", label: "Zarząd", desc: "Plusy, minusy, awanse, skargi, urlopy", multi: true },
  { key: "ranks", label: "Drabinka rang", desc: "Kliknij od NAJNIŻSZEJ do NAJWYŻSZEJ", multi: true },
  { key: "leave", label: "Ranga urlopowa", desc: "Nadawana na czas urlopu", multi: false },
] as const;

export const NUM_FIELDS = [
  { key: "minus_limit", label: "Minusy do auto-degradu", def: 3 },
  { key: "plus_promo", label: "Plusy do auto-awansu", def: 3 },
  { key: "appeal_days", label: "Dni na odwołanie", def: 7 },
  { key: "max_leave_days", label: "Maks. dni urlopu", def: 30 },
] as const;

export const isSnowflake = (v: unknown): v is string => typeof v === "string" && /^\d{17,20}$/.test(v);
