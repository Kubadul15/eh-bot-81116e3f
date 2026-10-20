import { Link } from "@tanstack/react-router";

export const inviteUrl = (clientId: string, guildId?: string) =>
  `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=1101927607382&scope=bot+applications.commands${guildId ? `&guild_id=${guildId}&disable_guild_select=true` : ""}`;

// Opens in a new tab: Discord's login page refuses to load inside the editor preview frame.
export function LoginButton() {
  return (
    <a href="/api/public/auth/login" target="_blank" rel="noreferrer" className="inline-block rounded-md bg-accent px-6 py-3 font-semibold text-accent-foreground transition hover:brightness-110">
      Zaloguj przez Discord
    </a>
  );
}

type User = { id: string; username: string; avatar: string | null } | null;

export function SiteHeader({ user }: { user: User }) {
  return (
    <>
      <div className="siren-bar h-1.5 w-full" />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
        <Link to="/" className="font-display text-2xl">
          EH <span className="text-primary">Bot</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          <Link to="/dashboard" className="hover:text-accent">Panel</Link>
          {user ? (
            <span className="flex items-center gap-2">
              {user.avatar && <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`} alt="" className="h-7 w-7 rounded-full" />}
              <a href="/api/public/auth/logout" className="text-muted-foreground hover:text-foreground">Wyloguj</a>
            </span>
          ) : null}
        </nav>
      </header>
    </>
  );
}
