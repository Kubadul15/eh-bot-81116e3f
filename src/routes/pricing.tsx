import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Check, Gem, Minus, Tag } from "lucide-react";
import { SiteHeader, SiteFooter, LoginButton, inviteUrl } from "@/components/site";
import { BuyButton, PremiumBadge } from "@/components/premium-ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMe, listGuilds } from "@/lib/dashboard.functions";
import { checkDiscountCode } from "@/lib/admin.functions";
import {
  COMPARISON,
  OWNER_ID,
  OWNER_PROFILE_URL,
  PRICE_LIFETIME_PLN,
  priceWithDiscount,
} from "@/lib/premium";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Cennik — Emergency Hamburg Bot" },
      {
        name: "description",
        content:
          "Plan Free na start, Premium lifetime za 20 zł jednorazowo: sąd, kasyno, captcha, własny wygląd i wyższe limity.",
      },
      { property: "og:title", content: "Cennik — Emergency Hamburg Bot" },
      {
        property: "og:description",
        content: "Premium lifetime za 20 zł. Jedna płatność, bez subskrypcji.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Pricing,
});

const FREE_POINTS = [
  "Urząd i mObywatel (do 150 obywateli)",
  "Ekonomia: praca, bank, nagrody, sklep",
  "Moderacja: ostrzeżenia, wyciszenia, bany, logi",
  "Tickety i bany Roblox",
  "Rekrutacja: 3 stanowiska, 5 pytań",
  "Poziomy XP, ankiety, sugestie, zabawy",
];
const PREMIUM_POINTS = [
  "Wszystko z Free – z wyższymi limitami",
  "⚖️ Sąd, adwokaci, prawnicy i kuratorzy",
  "🛡️ Panel administracji mObywatela",
  "🎰 Kasyno: sloty, ruletka, blackjack",
  "🔐 Weryfikacja captcha",
  "🎨 Własny wygląd wiadomości, webhook, 3 embedy",
  "📝 Rekrutacja: 25 stanowisk, 25 pytań",
  "💎 Priorytetowe wsparcie na Discordzie",
];
const STEPS = [
  {
    n: "01",
    t: "Kliknij „Kup Premium”",
    d: "Otworzy się mój profil na Discordzie, a gotowa wiadomość z Twoim serwerem trafi do schowka.",
  },
  {
    n: "02",
    t: "Napisz do mnie i zapłać",
    d: "Wklej wiadomość w rozmowie – ustalimy płatność (20 zł jednorazowo).",
  },
  {
    n: "03",
    t: "Aktywuję Premium",
    d: "Po wpłacie nadaję plan Twojemu serwerowi. Bot odblokowuje funkcje od razu, bez restartu.",
  },
];
const FAQ = [
  [
    "Czy to subskrypcja?",
    "Nie. Płacisz raz 20 zł i masz Premium na stałe dla jednego serwera – bez odnowień i ukrytych opłat.",
  ],
  [
    "Co znaczy „lifetime”?",
    "Premium jest aktywne bezterminowo, tak długo jak działa usługa bota. Szczegóły w regulaminie.",
  ],
  [
    "Jak wygląda płatność?",
    "Po kliknięciu „Kup Premium” otwiera się mój profil na Discordzie – tam piszemy i ustalamy płatność. Nie podajesz danych karty na tej stronie.",
  ],
  [
    "Mam kilka serwerów – co wtedy?",
    "Premium jest przypisane do jednego serwera. Dla kolejnych możesz kupić osobne albo napisz do mnie o rabat.",
  ],
  [
    "Mogę przenieść Premium na inny serwer?",
    "Tak, napisz do mnie – przeniosę plan (np. gdy zmieniasz serwer).",
  ],
  [
    "Co z moimi danymi, gdy nie mam Premium?",
    "Nic nie znika. Konfiguracja zostaje, a funkcje Premium po prostu się wyłączają (Free działa dalej w swoich limitach).",
  ],
  [
    "Mam kod rabatowy – gdzie go wpisać?",
    "Tu, nad przyciskiem „Kup”. Rabat widać od razu w cenie, a kod trafia do wiadomości do mnie.",
  ],
] as const;

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto size-4 text-emerald-600" aria-label="tak" />;
  if (v === false)
    return <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="nie" />;
  return <span className="text-sm">{v}</span>;
}

function Pricing() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const { data: guilds } = useQuery({
    queryKey: ["guilds"],
    queryFn: () => listGuilds(),
    enabled: !!me?.user,
  });
  const [guildId, setGuildId] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; percent: number } | null>(null);
  const [codeError, setCodeError] = useState("");
  const [checking, setChecking] = useState(false);

  const mine = (guilds ?? []).filter((g) => g.botIn && !g.premium);
  const chosen = mine.find((g) => g.id === guildId);
  const price = applied ? priceWithDiscount(applied.percent) : PRICE_LIFETIME_PLN;
  const groups = [...new Set(COMPARISON.map((r) => r.group))];

  async function applyCode() {
    setChecking(true);
    setCodeError("");
    try {
      const r = await checkDiscountCode({ data: { code: codeInput } });
      if (r.valid && r.percent)
        setApplied({ code: codeInput.trim().toUpperCase(), percent: r.percent });
      else {
        setApplied(null);
        setCodeError(r.reason ?? "Kod jest nieważny");
      }
    } catch {
      setCodeError("Nie udało się sprawdzić kodu");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="min-h-screen">
      <SiteHeader user={me?.user ?? null} isOwner={!!me?.isOwner} />

      <section className="hero-glow animate-fade-up px-5 pb-12 pt-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Cennik
        </p>
        <h1 className="mt-3 font-display text-6xl leading-none sm:text-7xl">
          Jedna płatność. <span className="text-primary">Na zawsze.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Zacznij za darmo, a gdy serwer urośnie – odblokuj sąd, kasyno, captcha i własny wygląd za
          20 zł, bez subskrypcji.
        </p>
        <p className="mx-auto mt-3 inline-block rounded-full border-2 border-emerald-500/60 bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-900">
          🎁 Nowy serwer?{" "}
          <a href="/dashboard" className="underline">
            Wypróbuj Premium przez 3 dni za darmo
          </a>{" "}
          – bez karty
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 px-5 md:grid-cols-2">
        <div className="card-lift flex flex-col rounded-2xl border bg-card p-7">
          <h2 className="font-display text-4xl">Free</h2>
          <p className="mt-1 text-muted-foreground">Na start i do mniejszych serwerów.</p>
          <p className="mt-5 font-display text-6xl">0 zł</p>
          <ul className="mt-5 flex-1 space-y-2.5 text-sm">
            {FREE_POINTS.map((p) => (
              <li key={p} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                {p}
              </li>
            ))}
          </ul>
          {me?.clientId && (
            <a
              href={inviteUrl(me.clientId)}
              className="mt-6 inline-block rounded-md border bg-secondary px-6 py-3 text-center font-semibold transition hover:-translate-y-0.5 hover:border-primary"
            >
              Dodaj bota za darmo
            </a>
          )}
        </div>

        <div className="card-lift relative flex flex-col rounded-2xl border-2 border-amber-500 bg-gradient-to-b from-amber-50 to-card p-7 shadow-[0_20px_60px_-25px_rgba(245,158,11,.6)]">
          <div className="absolute -top-3 left-6">
            <PremiumBadge className="px-3 py-1 text-xs" />
          </div>
          <h2 className="font-display text-4xl">
            Premium <span className="text-amber-600">Lifetime</span>
          </h2>
          <p className="mt-1 text-muted-foreground">Pełna moc bota dla jednego serwera.</p>
          <p className="mt-5 flex items-end gap-3 font-display text-6xl">
            {price} zł
            {applied && (
              <span className="mb-2 font-sans text-lg font-semibold text-muted-foreground line-through">
                {PRICE_LIFETIME_PLN} zł
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            jednorazowo • bez subskrypcji • bez odnowień
            {applied ? ` • rabat −${applied.percent}%` : ""}
          </p>
          <ul className="mt-5 flex-1 space-y-2.5 text-sm">
            {PREMIUM_POINTS.map((p) => (
              <li key={p} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-amber-600" />
                {p}
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-3 border-t pt-5">
            {me?.user && mine.length > 0 && (
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dla którego serwera?
                <select
                  className="editor-select mt-1 normal-case"
                  value={guildId}
                  onChange={(e) => setGuildId(e.target.value)}
                >
                  <option value="">— wybiorę w rozmowie —</option>
                  {mine.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!me?.user && (
              <p className="text-xs text-muted-foreground">
                Zaloguj się przez Discord, a podpowiem Twój serwer w wiadomości.{" "}
                <span className="ml-1 inline-block">
                  <LoginButton />
                </span>
              </p>
            )}
            <div>
              <div className="flex gap-2">
                <Input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="Masz kod rabatowy?"
                  maxLength={32}
                  aria-label="Kod rabatowy"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!codeInput.trim() || checking}
                  onClick={() => void applyCode()}
                >
                  <Tag />
                  Zastosuj
                </Button>
              </div>
              {applied && (
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  ✓ Kod {applied.code}: −{applied.percent}%
                </p>
              )}
              {codeError && (
                <p className="mt-1 text-xs font-semibold text-destructive">{codeError}</p>
              )}
            </div>
            <BuyButton
              guildId={chosen?.id ?? null}
              guildName={chosen?.name ?? null}
              username={me?.user?.username ?? null}
              code={applied?.code ?? null}
              price={price}
              className="w-full bg-amber-500 text-black hover:bg-amber-400"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16">
        <h2 className="font-display text-5xl">Porównanie planów</h2>
        <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b bg-muted/50 text-sm">
                <th className="px-4 py-3 font-semibold">Funkcja</th>
                <th className="w-32 px-4 py-3 text-center font-semibold">Free</th>
                <th className="w-32 px-4 py-3 text-center font-semibold text-amber-700">Premium</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr className="bg-muted/30">
                    <td
                      colSpan={3}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      {g}
                    </td>
                  </tr>
                  {COMPARISON.filter((r) => r.group === g).map((r) => (
                    <tr key={r.label} className="border-t text-sm">
                      <td className="px-4 py-2.5">{r.label}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Cell v={r.free} />
                      </td>
                      <td className="bg-amber-50/60 px-4 py-2.5 text-center font-semibold">
                        <Cell v={r.premium} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="font-display text-5xl">Jak kupić?</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card-lift rounded-lg border bg-card p-6">
              <div className="font-display text-5xl text-amber-600">{s.n}</div>
              <h3 className="mt-2 text-xl font-bold">{s.t}</h3>
              <p className="mt-1 text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          Profil właściciela:{" "}
          <a
            href={OWNER_PROFILE_URL}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            discord.com/users/{OWNER_ID}
          </a>
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="font-display text-5xl">Pytania i odpowiedzi</h2>
        <Accordion type="single" collapsible className="mt-4">
          {FAQ.map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger>{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Gem className="size-4" />
          Płacisz po rozmowie ze mną – nic nie jest pobierane automatycznie.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
