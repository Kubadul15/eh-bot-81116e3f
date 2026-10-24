import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gem, ShieldCheck } from "lucide-react";
import { getPublicNotice } from "@/lib/admin.functions";

// Uprawnienia bota: rangi, kanały, wiadomości, wyrzucanie/banowanie, wyciszanie (Moderate Members), webhooki, reakcje, zewnętrzne emoji.
export const BOT_PERMISSIONS = "1100317322326";
export const inviteUrl = (clientId: string, guildId?: string) =>
  `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${BOT_PERMISSIONS}&scope=bot+applications.commands${guildId ? `&guild_id=${guildId}&disable_guild_select=true` : ""}`;

// Opens in a new tab: Discord's login page refuses to load inside the editor preview frame.
export function LoginButton() {
  return (
    <a
      href="/api/public/auth/login"
      target="_blank"
      rel="noreferrer"
      className="inline-block rounded-md bg-accent px-6 py-3 font-semibold text-accent-foreground transition hover:brightness-110"
    >
      Zaloguj przez Discord
    </a>
  );
}

type User = { id: string; username: string; avatar: string | null } | null;

// Pasek ogłoszeń: tryb serwisowy i komunikat ustawiony przez właściciela w panelu administratora.
function NoticeBar() {
  const { data } = useQuery({
    queryKey: ["public-notice"],
    queryFn: () => getPublicNotice(),
    staleTime: 60_000,
  });
  if (!data) return null;
  const tone = {
    info: "bg-sky-600",
    warn: "bg-amber-500 text-black",
    danger: "bg-red-600",
  } as const;
  return (
    <>
      {data.maintenance && (
        <div className="bg-amber-500 px-5 py-2 text-center text-sm font-semibold text-black">
          🛠️ Trwają prace serwisowe – zapis zmian jest chwilowo wyłączony.
        </div>
      )}
      {data.notice && (
        <div
          className={`px-5 py-2 text-center text-sm font-semibold text-white ${tone[data.notice.level]}`}
        >
          {data.notice.text}
        </div>
      )}
    </>
  );
}

export function SiteHeader({ user, isOwner = false }: { user: User; isOwner?: boolean }) {
  const link = "hover:text-accent-foreground/70 transition";
  return (
    <>
      <div className="siren-bar h-1.5 w-full" />
      <NoticeBar />
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link to="/" className="font-display text-2xl">
          EH <span className="text-primary">Bot</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
          <Link to="/features" className={link}>
            Funkcje
          </Link>
          <Link to="/pricing" className={`${link} inline-flex items-center gap-1`}>
            <Gem className="size-3.5" />
            Cennik
          </Link>
          <Link to="/dashboard" className={link}>
            Panel
          </Link>
          <Link to="/terms" className={`${link} text-muted-foreground`}>
            Regulamin
          </Link>
          {isOwner && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-primary-foreground"
            >
              <ShieldCheck className="size-3.5" />
              Admin
            </Link>
          )}
          {user ? (
            <span className="flex items-center gap-2">
              {user.avatar && (
                <img
                  src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
                  alt=""
                  className="h-7 w-7 rounded-full"
                />
              )}
              <a
                href="/api/public/auth/logout"
                className="text-muted-foreground hover:text-foreground"
              >
                Wyloguj
              </a>
            </span>
          ) : null}
        </nav>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t px-5 py-8 text-center text-sm text-muted-foreground">
      <div className="mb-2 flex flex-wrap justify-center gap-x-5 gap-y-1 font-semibold">
        <Link to="/features" className="hover:text-foreground">
          Funkcje
        </Link>
        <Link to="/pricing" className="hover:text-foreground">
          Cennik
        </Link>
        <Link to="/terms" className="hover:text-foreground">
          Regulamin i prywatność
        </Link>
        <Link to="/dashboard" className="hover:text-foreground">
          Panel
        </Link>
      </div>
      Emergency Hamburg Bot · nie jest powiązany z Roblox ani twórcami gry.
    </footer>
  );
}
