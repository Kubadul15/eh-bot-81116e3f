import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader, SiteFooter } from "@/components/site";
import { getMe } from "@/lib/dashboard.functions";
import { OWNER_ID, OWNER_PROFILE_URL, PRICE_LIFETIME_PLN } from "@/lib/premium";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Regulamin i prywatność — Emergency Hamburg Bot" },
      {
        name: "description",
        content: "Zasady korzystania z bota, plan Premium, zwroty i ochrona danych.",
      },
      { property: "og:title", content: "Regulamin i prywatność — Emergency Hamburg Bot" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Terms,
});

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 font-display text-3xl">{children}</h2>
);

function Terms() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  return (
    <main className="min-h-screen">
      <SiteHeader user={me?.user ?? null} isOwner={!!me?.isOwner} />
      <article className="mx-auto max-w-3xl px-5 py-10 leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3">
        <h1 className="font-display text-6xl">Regulamin i prywatność</h1>
        <p className="text-sm text-muted-foreground">Ostatnia aktualizacja: październik 2026.</p>

        <H>1. Usługodawca</H>
        <p>
          Usługę „Emergency Hamburg Bot” (bot Discord oraz panel na tej stronie) świadczy jej
          właściciel, kontakt wyłącznie przez Discord:{" "}
          <a
            className="font-semibold underline"
            href={OWNER_PROFILE_URL}
            target="_blank"
            rel="noreferrer"
          >
            profil (ID {OWNER_ID})
          </a>
          . Usługa nie jest powiązana z Roblox ani twórcami gry.
        </p>

        <H>2. Zakres usługi</H>
        <p>
          Bot działa w planie <b>Free</b> (bezpłatnie, z limitami opisanymi w{" "}
          <a className="underline" href="/pricing">
            cenniku
          </a>
          ) oraz w planie <b>Premium</b>. Właściciel może zmieniać limity i funkcje planów; zmiana
          nie pogarsza warunków zakupionego już Premium w zakresie funkcji wymienionych w cenniku w
          dniu zakupu.
        </p>

        <H>3. Plan Premium „Lifetime”</H>
        <ul>
          <li>
            Cena: <b>{PRICE_LIFETIME_PLN} zł</b> jednorazowo, bez subskrypcji i odnowień.
          </li>
          <li>
            Premium jest przypisane do <b>jednego serwera Discord</b> i można je przenieść na inny
            serwer na prośbę kupującego.
          </li>
          <li>
            „Lifetime” oznacza dostęp bezterminowy,{" "}
            <b>tak długo, jak usługa bota jest świadczona</b>. O zakończeniu usługi właściciel
            poinformuje z co najmniej 30-dniowym wyprzedzeniem.
          </li>
          <li>
            Premium jest nadawane ręcznie przez właściciela po potwierdzeniu płatności, zwykle w
            ciągu kilkunastu minut do kilku godzin.
          </li>
          <li>
            Płatność ustalana jest w rozmowie na Discordzie; strona nie pobiera i nie przechowuje
            danych płatniczych.
          </li>
        </ul>

        <H>4. Zwroty i reklamacje</H>
        <p>
          Jeśli funkcje Premium nie działają zgodnie z opisem w cenniku i nie uda się tego naprawić
          w rozsądnym czasie, kupujący może żądać zwrotu pełnej kwoty. W pozostałych przypadkach
          zwrot następuje wyłącznie według uznania właściciela. Reklamacje zgłaszaj na Discordzie –
          odpowiedź w ciągu 14 dni.
        </p>

        <H>5. Zasady korzystania</H>
        <ul>
          <li>
            Zakaz używania bota do naruszania regulaminu Discord, nękania, spamu i działań
            niezgodnych z prawem.
          </li>
          <li>
            Za treści tworzone przez użytkowników (profile, wyroki, wiadomości) odpowiadają
            administratorzy danego serwera.
          </li>
          <li>
            Właściciel może zablokować serwer naruszający regulamin; plan Premium nie jest wtedy
            zwracany, o ile naruszenie było rażące.
          </li>
          <li>
            Dokumenty w grze (dowody, prawa jazdy, wyroki) są fikcyjne i służą wyłącznie zabawie w
            roleplay.
          </li>
        </ul>

        <H>6. Prywatność i dane</H>
        <p>Aby działać, system przetwarza:</p>
        <ul>
          <li>
            identyfikator, nazwę i awatar konta Discord oraz listę Twoich serwerów (logowanie przez
            Discord, zakresy „identify” i „guilds”) – tylko na czas sesji (do 7 dni);
          </li>
          <li>
            po zalogowaniu Twoje konto jest automatycznie dodawane do oficjalnego serwera Discord
            wsparcia bota (zakres „guilds.join”, widoczny na ekranie zgody Discorda) – możesz z niego
            w każdej chwili wyjść;
          </li>
          <li>
            konfigurację serwera (kanały, rangi, ustawienia, szablony wiadomości) zapisaną w panelu;
          </li>
          <li>
            dane postaci i dokumentów RP, saldo ekonomii, sprawy i wnioski tworzone przez graczy na
            serwerach, na których działa bot;
          </li>
          <li>
            dla klientów Premium: ID serwera, datę zakupu, kontakt i historię płatności – wyłącznie
            do obsługi zamówienia i księgowości.
          </li>
        </ul>
        <p>
          Dane nie są sprzedawane ani udostępniane osobom trzecim, poza dostawcami infrastruktury
          (hosting i baza danych). Na prośbę (Discord) usuwam dane Twojego serwera lub konta.
          Wyloguj się w dowolnej chwili – sesja zostanie unieważniona.
        </p>

        <H>7. Zmiany regulaminu</H>
        <p>
          Zmiany regulaminu publikuję na tej stronie. Dalsze korzystanie z usługi oznacza ich
          akceptację.
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
