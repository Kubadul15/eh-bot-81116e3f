import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader, SiteFooter, inviteUrl } from "@/components/site";
import { PremiumBadge } from "@/components/premium-ui";
import { getMe } from "@/lib/dashboard.functions";
import { PRICE_LIFETIME_PLN } from "@/lib/premium";

// CLIENT_ID bota z Discord Developer Portal
const CLIENT_ID = "1562063009470357566";
const INVITE = inviteUrl(CLIENT_ID);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Emergency Hamburg Bot — bot RP na Discorda: urząd, sąd, ekonomia" },
      {
        name: "description",
        content: `Urząd, mObywatel, sąd, ekonomia, moderacja, rekrutacja i tickety. Zacznij za darmo, Premium lifetime za ${PRICE_LIFETIME_PLN} zł.`,
      },
      { property: "og:title", content: "Emergency Hamburg Bot" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content:
          "Bot do serwerów RP: urząd, sąd, ekonomia, moderacja. Konfiguracja w panelu na stronie.",
      },
    ],
  }),
  component: Index,
});

const FEATURES: { e: string; t: string; d: string; premium?: boolean }[] = [
  {
    e: "🏛️",
    t: "Urząd i mObywatel",
    d: "Dowody osobiste, prawa jazdy (A, B, C, D, T), licencje i rejestracja pojazdów z kartami graficznymi.",
  },
  {
    e: "⚖️",
    t: "Sąd, adwokaci, kuratorzy",
    d: "Sprawy, rozprawy, wyroki ze skutkami, rachunki za obronę i dozór z meldunkami.",
    premium: true,
  },
  {
    e: "💰",
    t: "Ekonomia",
    d: "Praca, bank, sklep, pensje dla rang, ranking – i kasyno dla odważnych.",
  },
  {
    e: "🔨",
    t: "Moderacja",
    d: "Ostrzeżenia, wyciszenia, bany, czyszczenie, blokady kanałów i pełne logi.",
  },
  {
    e: "📋",
    t: "Rekrutacja i tickety",
    d: "Nabory frakcji z własnymi pytaniami oraz prywatne kanały zgłoszeń.",
  },
  {
    e: "🔐",
    t: "Weryfikacja captcha",
    d: "Kod z obrazka dla nowych osób i automatyczne nadawanie rang.",
    premium: true,
  },
  {
    e: "📣",
    t: "Kreator wiadomości",
    d: "Embedy z podglądem na żywo, wysyłka z panelu, webhook z własną nazwą.",
    premium: true,
  },
  {
    e: "⚡",
    t: "Konfiguracja w panelu",
    d: "Kanały, rangi i panele ustawiasz na stronie – wszystko bez komend na Discordzie.",
  },
];

const STEPS = [
  { n: "01", t: "Dodaj bota", d: "Kliknij „Dodaj na serwer” i wybierz swój serwer." },
  {
    n: "02",
    t: "Otwórz Dashboard",
    d: "Zaloguj się przez Discord i wybierz kanały oraz rangi z listy na stronie.",
  },
  {
    n: "03",
    t: "Gotowe",
    d: "Zapisz zmiany i wyślij panele jednym kliknięciem. Premium odblokujesz w każdej chwili.",
  },
];

function Index() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  return (
    <main className="min-h-screen">
      <SiteHeader user={me?.user ?? null} isOwner={!!me?.isOwner} />
      <section className="hero-glow animate-fade-up px-5 pb-20 pt-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Bot Discord · Roleplay
        </p>
        <h1 className="mt-4 font-display text-6xl leading-none sm:text-8xl">
          Emergency <span className="text-primary">Hamburg</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Wszystko, czego potrzebuje serwer RP — urząd, sąd, ekonomia, policja, bany i
          administracja. Ustawiasz to w wygodnym panelu na stronie.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={INVITE}
            className="rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:brightness-110"
          >
            Dodaj na serwer
          </a>
          <Link
            to="/pricing"
            className="rounded-md bg-amber-500 px-6 py-3 font-semibold text-black transition hover:brightness-110"
          >
            Premium – {PRICE_LIFETIME_PLN} zł na zawsze
          </Link>
          <Link
            to="/dashboard"
            className="rounded-md border bg-secondary px-6 py-3 font-semibold text-secondary-foreground transition hover:-translate-y-0.5 hover:border-accent"
          >
            Dashboard
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-5xl">Funkcje</h2>
          <Link to="/features" className="text-sm font-semibold text-primary hover:underline">
            Wszystkie funkcje →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.t}
              className="card-lift animate-fade-up rounded-lg border bg-card p-5"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="text-3xl">{f.e}</div>
                {f.premium && <PremiumBadge />}
              </div>
              <h3 className="mt-3 text-lg font-bold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="setup" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-5xl">Setup w 3 krokach</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card-lift rounded-lg border bg-card p-6">
              <div className="font-display text-5xl text-accent">{s.n}</div>
              <h3 className="mt-2 text-xl font-bold">{s.t}</h3>
              <p className="mt-1 text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h2 className="font-display text-5xl">Gotowy na służbę?</h2>
        <p className="mt-2 text-muted-foreground">
          Zacznij za darmo. Premium odblokuje sąd, kasyno, captcha i własny wygląd – jedna płatność,
          bez subskrypcji.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={INVITE}
            className="rounded-md bg-primary px-8 py-3 font-semibold text-primary-foreground transition hover:brightness-110"
          >
            Dodaj bota za darmo
          </a>
          <Link
            to="/pricing"
            className="rounded-md border bg-secondary px-8 py-3 font-semibold transition hover:-translate-y-0.5 hover:border-amber-500"
          >
            Zobacz cennik
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
