// Shared between dashboard UI and server validation. Keys must match bot's lib/channels.js and lib/config.js keys.
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
  { id: "sad", name: "⚖️ Wymiar sprawiedliwości", slots: [
    ["sadpanel", "⚖️", "Panel sądu", "Pozwy, status spraw, rozprawy i panel sędziego/prokuratora"],
    ["adwpanel", "🧑‍⚖️", "Panel adwokatów", "Obywatele zlecają sprawy adwokatom"],
    ["prawpanel", "📚", "Panel prawników (poradnia)", "Porady prawne i pisma procesowe"],
    ["kurpanel", "🪢", "Panel kuratorów", "Dozór: meldunki i panel kuratora"],
    ["sprawy", "📁", "Rejestr spraw i wyroków", "Nowe sprawy (z przyciskami dla sędziego), wyroki i pisma"],
    ["rozprawy", "📅", "Rozprawy", "Ogłoszenia terminów i przypomnienia 15 min przed (puste = rejestr spraw)"],
    ["zlecenia", "💼", "Zlecenia dla adwokatów i prawników", "Tu adwokaci podejmują zlecenia i wystawiają rachunki (puste = rejestr spraw)"],
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
  { id: "ekonomia", name: "💰 Ekonomia", slots: [
    ["ekokanal", "🔒", "Kanał komend ekonomii", "Komendy (/saldo, !bal…) i przyciski ekonomii działają tylko tu i w jego wątkach. Puste = na każdym kanale"],
    ["ekopanel", "💰", "Panel ekonomii", "Przyciski: portfel, praca, codzienna nagroda, sklep, ranking"],
    ["ekolog", "📜", "Logi ekonomii", "Operacje administracji na pieniądzach (opcjonalnie)"],
  ] },
  { id: "moderacja", name: "🔨 Bany i moderacja", slots: [
    ["ban", "🔨", "Kanał banów", "Tu trafiają bany Roblox z /ban"],
    ["modlog", "📜", "Logi moderacji", "Ostrzeżenia, wyciszenia, kicki i bany z /mod"],
    ["zgloszenia", "🚩", "Zgłoszenia graczy", "Gdzie trafia /zglos (puste = logi moderacji)"],
  ] },
  { id: "spolecznosc", name: "🎉 Społeczność", slots: [
    ["powitania", "👋", "Powitania", "Nowe osoby (wymaga włączonej intencji Server Members – zobacz opis bota)"],
    ["sugestie", "💡", "Sugestie", "Gdzie trafia /sugestia z głosowaniem 👍/👎"],
    ["poziomy", "⭐", "Awanse poziomów", "Opcjonalnie: ogłoszenia awansów (puste = kanał, na którym ktoś napisał)"],
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
];
export const CHANNEL_KEYS = CHANNEL_SECTIONS.flatMap((s) => s.slots.map((x) => x[0]));

// Panele, które można wysłać ze strony. slot = klucz kanału z CHANNEL_SECTIONS, key musi pasować do bota (modules/panels.js).
export const PANEL_SLOTS = [
  { key: "urzad", emoji: "🏛️", label: "Urząd (mObywatel)", slot: "panel" },
  { key: "sad", emoji: "⚖️", label: "Sąd", slot: "sadpanel" },
  { key: "adwokaci", emoji: "🧑‍⚖️", label: "Adwokaci", slot: "adwpanel" },
  { key: "prawnicy", emoji: "📚", label: "Prawnicy (poradnia)", slot: "prawpanel" },
  { key: "kuratorzy", emoji: "🪢", label: "Kuratorzy", slot: "kurpanel" },
  { key: "opinie", emoji: "💬", label: "Pochwały i skargi", slot: "opiniepanel" },
  { key: "staff", emoji: "🛡️", label: "Panel administracji", slot: "staffpanel" },
  { key: "ekonomia", emoji: "💰", label: "Ekonomia", slot: "ekopanel" },
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
  { key: "ban", label: "Mogą banować", desc: "Dostęp do komend /ban i /mod", multi: true },
  { key: "mod", label: "Moderatorzy", desc: "Dostęp do /mod (ostrzeżenia, wyciszenia, kicki…), konkursów i zgłoszeń", multi: true },
  { key: "police", label: "Policja / służby", desc: "Dostęp do komendy /kontrola", multi: true },
  { key: "moby_admin", label: "Administracja mObywatela", desc: "Kto może kliknąć „Panel administracji” w Urzędzie. Bez wyboru – cała ekipa", multi: true },
  { key: "judge", label: "Sędziowie", desc: "Przyjmują sprawy, wyznaczają rozprawy i wydają wyroki", multi: true },
  { key: "prosecutor", label: "Prokuratorzy", desc: "Wnoszą akty oskarżenia w sprawach karnych", multi: true },
  { key: "lawyer", label: "Adwokaci", desc: "Podejmują zlecenia obrony i wystawiają rachunki", multi: true },
  { key: "legal", label: "Prawnicy (doradcy prawni)", desc: "Udzielają porad prawnych", multi: true },
  { key: "probation", label: "Kuratorzy", desc: "Prowadzą dozór: meldunki, naruszenia, przedłużanie", multi: true },
  { key: "verified", label: "Rangi po weryfikacji", desc: "Nadawane po poprawnym kodzie captcha – możesz wybrać kilka", multi: true },
  { key: "unverified", label: "Rangi przed weryfikacją", desc: "Zdejmowane po weryfikacji (opcjonalnie, też kilka)", multi: true },
  { key: "autorole", label: "Autorole", desc: "Nadawane każdej nowej osobie (wymaga intencji Server Members)", multi: true },
];

export type NumField = { key: string; label: string; def: number; min?: number; max?: number };
export const NUM_FIELDS: NumField[] = [
  { key: "minus_limit", label: "Minusy do auto-degradu", def: 3 },
  { key: "plus_promo", label: "Plusy do auto-awansu", def: 3 },
  { key: "appeal_days", label: "Dni na odwołanie", def: 7 },
  { key: "max_leave_days", label: "Maks. dni urlopu", def: 30 },
  { key: "warn_limit", label: "Ostrzeżeń do automatycznego wyciszenia (24 h)", def: 3, max: 20 },
  { key: "eco_start", label: "Kwota startowa nowego konta (zł)", def: 1000, max: 1_000_000 },
  { key: "eco_daily", label: "Codzienna nagroda (zł)", def: 500, max: 1_000_000 },
  { key: "eco_work_min", label: "Praca: minimalny zarobek (zł)", def: 100, max: 100_000 },
  { key: "eco_work_max", label: "Praca: maksymalny zarobek (zł)", def: 400, max: 100_000 },
];

// Kategorie widoczne w panelu: co do czego należy. sections = id z CHANNEL_SECTIONS.
export type Category = {
  id: string; emoji: string; label: string; desc: string;
  sections: string[]; roles: string[]; nums: string[]; panels: string[]; recruitment?: boolean;
  premiumOnly?: boolean; premiumNote?: string; // cała kategoria w Premium / uwaga o ograniczeniach planu Free
};
export const CATEGORIES: Category[] = [
  { id: "urzad", emoji: "🏛️", label: "Urząd", desc: "mObywatel: dowody, prawa jazdy, licencje, pojazdy i panel administracji", sections: ["urzad"], roles: ["moby_admin", "police"], nums: [], panels: ["urzad"], premiumNote: "Panel administracji mObywatela (kartoteka, zawieszenia, mandaty) wymaga Premium. Limity Free: 150 obywateli, 3 pojazdy na osobę." },
  { id: "sad", emoji: "⚖️", label: "Wymiar sprawiedliwości", desc: "Sąd, adwokaci, prawnicy i kuratorzy: sprawy, rozprawy, wyroki, dozór, rachunki", sections: ["sad"], roles: ["judge", "prosecutor", "lawyer", "legal", "probation"], nums: [], panels: ["sad", "adwokaci", "prawnicy", "kuratorzy"], premiumOnly: true },
  { id: "admin", emoji: "🛡️", label: "Administracja", desc: "Ekipa: urlopy, awanse, plusy/minusy, pochwały i skargi", sections: ["admin"], roles: ["staff", "management", "ranks", "leave"], nums: ["minus_limit", "plus_promo", "appeal_days", "max_leave_days"], panels: ["opinie", "staff"] },
  { id: "ekonomia", emoji: "💰", label: "Ekonomia", desc: "Pieniądze w grze: praca, nagrody, bank, sklep, pensje dla rang, gry i ranking", sections: ["ekonomia"], roles: [], nums: ["eco_start", "eco_daily", "eco_work_min", "eco_work_max"], panels: ["ekonomia"], premiumNote: "Kasyno (sloty, ruletka, blackjack, orzeł) i sklep powyżej 5 przedmiotów wymagają Premium." },
  { id: "moderacja", emoji: "🔨", label: "Moderacja", desc: "Bany, ostrzeżenia, wyciszenia, kicki, czyszczenie i blokady kanałów", sections: ["moderacja"], roles: ["mod", "ban"], nums: ["warn_limit"], panels: [] },
  { id: "spolecznosc", emoji: "🎉", label: "Społeczność", desc: "Powitania, autorole, sugestie, poziomy XP, ankiety i konkursy", sections: ["spolecznosc"], roles: ["autorole"], nums: [], panels: [], premiumNote: "Własna treść powitania to funkcja Premium. W Free działa jeden konkurs naraz." },
  { id: "tickety", emoji: "🎫", label: "Tickety", desc: "Zgłoszenia graczy w prywatnych kanałach", sections: ["tickety"], roles: [], nums: [], panels: ["tickety"] },
  { id: "rekrutacja", emoji: "📝", label: "Rekrutacja", desc: "Nabór: stanowiska, formularz i aplikacje", sections: ["rekrutacja"], roles: [], nums: [], panels: ["rekrutacja"], recruitment: true, premiumNote: "Plan Free: do 3 stanowisk i 5 pytań w formularzu. Premium: 25 stanowisk i 15 pytań." },
  { id: "weryfikacja", emoji: "🔐", label: "Weryfikacja", desc: "Captcha dla nowych osób i nadawanie rang", sections: ["weryfikacja"], roles: ["verified", "unverified"], nums: [], panels: ["weryfikacja"], premiumOnly: true },
];

export const isSnowflake = (v: unknown): v is string => typeof v === "string" && /^\d{17,20}$/.test(v);
