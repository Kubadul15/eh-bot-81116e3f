import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getMe, listGuilds } from "@/lib/dashboard.functions";
import { SiteHeader, LoginButton, inviteUrl } from "@/components/site";

const meQ = queryOptions({ queryKey: ["me"], queryFn: () => getMe() });
const guildsQ = queryOptions({ queryKey: ["guilds"], queryFn: () => listGuilds() });

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Panel — Emergency Hamburg Bot" },
      { name: "description", content: "Wybierz serwer i skonfiguruj bota Emergency Hamburg." },
      { property: "og:title", content: "Panel — Emergency Hamburg Bot" },
      { property: "og:description", content: "Konfiguracja bota przez stronę." },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([context.queryClient.ensureQueryData(meQ), context.queryClient.ensureQueryData(guildsQ)]);
  },
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useSuspenseQuery(meQ);
  const { data: guilds } = useSuspenseQuery(guildsQ);

  return (
    <main className="min-h-screen">
      <SiteHeader user={me.user} />
      <section className="mx-auto max-w-5xl px-5 py-10">
        {!me.user || !guilds ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <h1 className="font-display text-5xl">Zaloguj się</h1>
            <p className="mt-2 text-muted-foreground">Zaloguj się przez Discord, żeby zobaczyć swoje serwery.</p>
            <div className="mt-6"><LoginButton /></div>
          </div>
        ) : (
          <>
            <h1 className="font-display text-5xl">Twoje serwery</h1>
            <p className="mt-1 text-muted-foreground">Serwery, na których masz uprawnienie „Zarządzanie serwerem”.</p>
            {guilds.length === 0 && <p className="mt-8 text-muted-foreground">Brak serwerów.</p>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {guilds.map((g) => (
                <div key={g.id} className="flex items-center gap-3 rounded-lg border bg-card p-4">
                  {g.icon ? (
                    <img src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=96`} alt="" className="h-12 w-12 rounded-full" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary font-bold">{g.name[0]}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{g.name}</div>
                    {g.botIn ? (
                      <Link to="/dashboard/$guildId" params={{ guildId: g.id }} className="text-sm font-semibold text-accent hover:underline">
                        Konfiguruj →
                      </Link>
                    ) : me.clientId ? (
                      <a href={inviteUrl(me.clientId, g.id)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline">
                        Dodaj bota +
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
