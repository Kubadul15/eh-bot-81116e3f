import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader, SiteFooter } from "@/components/site";
import { PremiumBadge } from "@/components/premium-ui";
import { getMe } from "@/lib/dashboard.functions";
import { useI18n } from "@/lib/i18n-react";
import { headL } from "@/lib/i18n";

export const Route = createFileRoute("/features")({
  head: ({ match }) => {
    const L = headL(match);
    return {
      meta: [
        { title: L("Funkcje — Emergency Hamburg Bot") },
        {
          name: "description",
          content: L(
            "Urząd, sąd, policja, nieruchomości, moderacja, rekrutacja, tickety i weryfikacja – wszystko dla serwerów RP.",
          ),
        },
        { property: "og:title", content: L("Funkcje — Emergency Hamburg Bot") },
        { property: "og:type", content: "website" },
      ],
    };
  },
  component: Features,
});

type Item = { e: string; t: string; d: string; premium?: boolean };
const GROUPS: { name: string; items: Item[] }[] = [
  {
    name: "RolePlay",
    items: [
      {
        e: "🏛️",
        t: "Urząd i mObywatel",
        d: "Dowody, prawa jazdy (A, B, C, D, T), licencje na broń, rejestr pojazdów, wnioski rozpatrywane przez ekipę, karty graficzne z hologramem.",
      },
      {
        e: "🛡️",
        t: "Panel administracji mObywatela",
        d: "Kartoteka obywatela: zawieszenia dokumentów, mandaty, notatki, edycja danych, nowe dowody i log każdej akcji.",
        premium: true,
      },
      {
        e: "⚖️",
        t: "Sąd i wyroki",
        d: "Pozwy, panel sędziego i prokuratora, rozprawy z przypomnieniem, akty oskarżenia, wyroki, które działają: grzywna, dozór, areszt.",
        premium: true,
      },
      {
        e: "🧑‍⚖️",
        t: "Adwokaci i prawnicy",
        d: "Zlecenia dla adwokatów, porady prawne i pisma procesowe dołączane do spraw.",
        premium: true,
      },
      {
        e: "🪢",
        t: "Kuratorzy",
        d: "Dozór z meldunkami, naruszenia i automatyczny wniosek o uchylenie po trzech wpadkach.",
        premium: true,
      },
      {
        e: "🚓",
        t: "Kontrola policyjna",
        d: "Służby sprawdzają obywateli, tablice rejestracyjne i status poszukiwania jedną komendą.",
      },
    ],
  },
  {
    name: "Administracja serwera",
    items: [
      {
        e: "🔨",
        t: "Moderacja",
        d: "Ostrzeżenia z automatycznym wyciszeniem, timeout, kick, ban, czyszczenie, tryb powolny, blokada kanałów, historia i logi.",
      },
      {
        e: "🔐",
        t: "Weryfikacja captcha",
        d: "Kod z obrazka dla nowych osób, nadawanie kilku rang naraz, blokada po błędnych próbach.",
        premium: true,
      },
      {
        e: "📋",
        t: "Rekrutacja",
        d: "Własne stanowiska i pytania, otwieranie i zamykanie naborów, decyzje jednym kliknięciem.",
      },
      {
        e: "🎫",
        t: "Tickety",
        d: "Pomoc, zgłoszenia, odwołania od banów i współprace w osobnych kanałach z transkryptami.",
      },
      {
        e: "⭐",
        t: "Panel administracji ekipy",
        d: "Plusy, minusy, auto-awanse i degrady, pochwały, skargi, urlopy i odwołania.",
      },
    ],
  },
  {
    name: "Społeczność i wygląd",
    items: [
      {
        e: "🎉",
        t: "Poziomy, ankiety, konkursy",
        d: "XP za rozmowy, ankiety z paskami, konkursy z losowaniem, przypomnienia, sugestie z głosowaniem, zgłoszenia.",
      },
      {
        e: "🎨",
        t: "Własny wygląd",
        d: "Kolory, obrazki i stopki wiadomości bota oraz treść powitania w Twoim stylu.",
        premium: true,
      },
      {
        e: "📣",
        t: "Kreator wiadomości",
        d: "Embedy z podglądem na żywo i wysyłką z panelu. W Premium: webhook z własną nazwą i avatarem oraz do 3 embedów.",
        premium: true,
      },
      {
        e: "⚡",
        t: "Szybkie panele",
        d: "Wyślij panel z dashboardu, a pojawi się na Discordzie po kilku sekundach.",
      },
    ],
  },
];

function Features() {
  const { t } = useI18n();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  return (
    <main className="min-h-screen">
      <SiteHeader user={me?.user ?? null} isOwner={!!me?.isOwner} />
      <section className="hero-glow animate-fade-up px-5 pb-10 pt-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          {t("Funkcje")}
        </p>
        <h1 className="mt-3 font-display text-6xl leading-none sm:text-7xl">
          {t("Wszystko dla serwera")} <span className="text-primary">{t("RP")}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          {t("Funkcje z oznaczeniem")} <PremiumBadge className="mx-0.5 align-middle" />{" "}
          {t("są w planie Premium (20 zł, na zawsze). Reszta działa za darmo.")}
        </p>
      </section>
      <div className="mx-auto max-w-6xl space-y-12 px-5 pb-16">
        {GROUPS.map((g) => (
          <section key={g.name}>
            <h2 className="font-display text-4xl">{t(g.name)}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((f) => (
                <div key={f.t} className="card-lift rounded-lg border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="text-3xl">{f.e}</div>
                    {f.premium && <PremiumBadge />}
                  </div>
                  <h3 className="mt-3 text-lg font-bold">{t(f.t)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t(f.d)}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
        <div className="text-center">
          <Link
            to="/pricing"
            className="inline-block rounded-md bg-amber-500 px-8 py-3 font-semibold text-black transition hover:brightness-110"
          >
            {t("Zobacz cennik")}
          </Link>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
