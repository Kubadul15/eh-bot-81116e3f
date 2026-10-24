import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  Gem,
  History,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Server,
  ShieldCheck,
  Tag,
  Wrench,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader, LoginButton } from "@/components/site";
import { getMe } from "@/lib/dashboard.functions";
import { Overview } from "@/components/admin/overview";
import { Servers } from "@/components/admin/servers";
import { PremiumTab } from "@/components/admin/premium-tab";
import { CodesTab } from "@/components/admin/codes-tab";
import { NoticesTab } from "@/components/admin/notices-tab";
import { AuditTab, SessionsTab, ToolsTab } from "@/components/admin/tools-tab";

const meQ = queryOptions({ queryKey: ["me"], queryFn: () => getMe() });

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administrator — Emergency Hamburg Bot" },
      { name: "robots", content: "noindex, nofollow" }, // panel prywatny
    ],
  }),
  component: AdminPage,
});

type Tab =
  "overview" | "servers" | "premium" | "codes" | "notices" | "sessions" | "tools" | "audit";
const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Przegląd", icon: LayoutDashboard },
  { id: "servers", label: "Serwery", icon: Server },
  { id: "premium", label: "Premium i płatności", icon: Gem },
  { id: "codes", label: "Kody rabatowe", icon: Tag },
  { id: "notices", label: "Ogłoszenia i serwis", icon: Megaphone },
  { id: "sessions", label: "Sesje", icon: KeyRound },
  { id: "tools", label: "Narzędzia i kopie", icon: Wrench },
  { id: "audit", label: "Dziennik", icon: History },
];

function AdminPage() {
  const me = useQuery(meQ);
  if (me.isLoading)
    return (
      <main className="min-h-screen">
        <SiteHeader user={null} />
        <p className="p-10 text-center text-muted-foreground">Wczytywanie…</p>
      </main>
    );

  // Niezalogowani dostają logowanie; zalogowani, ale nie będący właścicielem, zwykłą „nie znaleziono” – bez zdradzania, że panel istnieje.
  if (!me.data?.user) {
    return (
      <main className="min-h-screen">
        <SiteHeader user={null} />
        <div className="mx-auto max-w-md px-5 py-16 text-center">
          <h1 className="font-display text-4xl">Zaloguj się</h1>
          <div className="mt-6">
            <LoginButton />
          </div>
        </div>
      </main>
    );
  }
  if (!me.data.isOwner) {
    return (
      <main className="min-h-screen">
        <SiteHeader user={me.data.user} />
        <div className="mx-auto max-w-md px-5 py-16 text-center">
          <h1 className="text-7xl font-bold">404</h1>
          <p className="mt-2 text-muted-foreground">Nie znaleziono strony.</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Wróć na stronę główną
          </Link>
        </div>
      </main>
    );
  }
  return <AdminShell user={me.data.user} />;
}

function AdminShell({ user }: { user: NonNullable<Awaited<ReturnType<typeof getMe>>["user"]> }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [server, setServer] = useState<string | null>(null);
  const openServer = (id: string) => {
    setServer(id);
    setTab("servers");
  };

  return (
    <main className="min-h-screen pb-16">
      <SiteHeader user={user} isOwner />
      <Toaster richColors position="top-right" />
      <section className="mx-auto max-w-7xl px-5 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <ShieldCheck className="size-8" />
          <div>
            <h1 className="font-display text-5xl leading-none">Panel administratora</h1>
            <p className="text-sm text-muted-foreground">
              Zalogowany jako {user.username} • dostęp tylko dla właściciela bota
            </p>
          </div>
        </div>

        <nav
          className="mt-6 flex gap-2 overflow-x-auto border-b pb-3"
          aria-label="Sekcje panelu administratora"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => {
                setTab(t.id);
                if (t.id !== "servers") setServer(null);
              }}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${tab === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {tab === "overview" && <Overview onOpenServer={openServer} />}
          {tab === "servers" && <Servers selected={server} onSelect={setServer} />}
          {tab === "premium" && <PremiumTab onOpenServer={openServer} />}
          {tab === "codes" && <CodesTab />}
          {tab === "notices" && <NoticesTab />}
          {tab === "sessions" && <SessionsTab />}
          {tab === "tools" && <ToolsTab />}
          {tab === "audit" && <AuditTab onOpenServer={openServer} />}
        </div>
      </section>
    </main>
  );
}
