import { createFileRoute } from "@tanstack/react-router";

// Wpisz tu CLIENT_ID swojego bota z Discord Developer Portal
const CLIENT_ID = "TWOJ_CLIENT_ID";
const INVITE = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot+applications.commands`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Emergency Hamburg Bot — darmowy bot RP na Discorda" },
      { name: "description", content: "Urząd, mObywatel, bany, tickety, rekrutacja i panel administracji. Wszystko ustawiasz komendą /setup. Bez premium." },
      { property: "og:title", content: "Emergency Hamburg Bot" },
      { property: "og:description", content: "Darmowy bot do serwerów RP Emergency Hamburg. Konfiguracja w całości na Discordzie." },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { e: "🏛️", t: "Urząd i mObywatel", d: "Dowody osobiste, prawa jazdy (A, B, C, D, T), rejestracja pojazdów i karty graczy." },
  { e: "🔨", t: "System banów", d: "Sprawy z numerem, podgląd przed wysłaniem, bany czasowe i permanentne, powiązanie z Roblox." },
  { e: "🚓", t: "Kontrola policyjna", d: "Służby sprawdzają obywateli i wystawiają mandaty prosto z Discorda." },
  { e: "🎫", t: "Tickety", d: "Pomoc, zgłoszenia graczy, odwołania od banów i współprace — w osobnych kanałach." },
  { e: "📋", t: "Rekrutacja", d: "Policja, straż i inne frakcje. Własne pytania, otwieranie i zamykanie naborów." },
  { e: "⭐", t: "Panel administracji", d: "Plusy, minusy, auto-awanse i degrady, pochwały, skargi, urlopy i odwołania." },
  { e: "✨", t: "Kreator embedów", d: "Ładne ogłoszenia z formularza, z podglądem na żywo." },
  { e: "🆓", t: "Bez premium", d: "Każda funkcja jest darmowa. Żadnych płatnych blokad." },
];

const STEPS = [
  { n: "01", t: "Dodaj bota", d: "Kliknij „Dodaj na serwer” i wybierz swój serwer." },
  { n: "02", t: "Wpisz /setup", d: "Otworzy się panel. Wybierasz kanały z listy — nic nie wpisujesz ręcznie." },
  { n: "03", t: "Gotowe", d: "Panele Urzędu, ticketów i rekrutacji pojawią się same na wybranych kanałach." },
];

function Index() {
  return (
    <main className="min-h-screen">
      <div className="siren-bar h-1.5 w-full" />
      <section className="hero-glow px-5 pb-20 pt-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Bot Discord · Roleplay</p>
        <h1 className="mt-4 font-display text-6xl leading-none sm:text-8xl">
          Emergency <span className="text-primary">Hamburg</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Wszystko, czego potrzebuje serwer RP — urząd, policja, bany, tickety i administracja. Ustawiasz to w całości na Discordzie.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={INVITE} className="rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:brightness-110">
            Dodaj na serwer
          </a>
          <a href="#setup" className="rounded-md border bg-secondary px-6 py-3 font-semibold text-secondary-foreground transition hover:bg-muted">
            Jak to ustawić?
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-5xl">Funkcje</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-lg border bg-card p-5 transition hover:border-accent">
              <div className="text-3xl">{f.e}</div>
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
            <div key={s.n} className="rounded-lg border bg-card p-6">
              <div className="font-display text-5xl text-accent">{s.n}</div>
              <h3 className="mt-2 text-xl font-bold">{s.t}</h3>
              <p className="mt-1 text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h2 className="font-display text-5xl">Gotowy na służbę?</h2>
        <a href={INVITE} className="mt-6 inline-block rounded-md bg-primary px-8 py-3 font-semibold text-primary-foreground transition hover:brightness-110">
          Dodaj bota za darmo
        </a>
      </section>

      <footer className="border-t px-5 py-8 text-center text-sm text-muted-foreground">
        Emergency Hamburg Bot · nie jest powiązany z Roblox ani twórcami gry.
      </footer>
    </main>
  );
}
