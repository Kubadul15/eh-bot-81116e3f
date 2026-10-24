import { useState } from "react";
import { Check, Gem, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackBuyClick } from "@/lib/admin.functions";
import { OWNER_ID, OWNER_PROFILE_URL, PRICE_LIFETIME_PLN } from "@/lib/premium";

/** Gotowa wiadomość, którą kupujący wklei właścicielowi na Discordzie (zawiera serwer, cenę i ewentualny kod). */
export function buyMessage(o: {
  guildName?: string | null;
  guildId?: string | null;
  username?: string | null;
  code?: string | null;
  price?: number;
}): string {
  const price = o.price ?? PRICE_LIFETIME_PLN;
  return [
    `Cześć! Chcę kupić Premium (lifetime, ${price} zł) do Emergency Hamburg Bot.`,
    o.guildName || o.guildId
      ? `Serwer: ${o.guildName ?? "?"}${o.guildId ? ` (ID: ${o.guildId})` : ""}`
      : "Serwer: (podam w rozmowie)",
    o.code ? `Kod rabatowy: ${o.code}` : null,
    o.username ? `Mój Discord: ${o.username}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Kopiuje wiadomość do schowka, zapisuje kliknięcie (lead) i otwiera profil właściciela na Discordzie. Zwraca, czy udało się skopiować. */
export async function startPurchase(o: Parameters<typeof buyMessage>[0]): Promise<boolean> {
  let copied = false;
  try {
    await navigator.clipboard.writeText(buyMessage(o));
    copied = true;
  } catch {
    /* brak dostępu do schowka */
  }
  void trackBuyClick({ data: { guildId: o.guildId ?? null, code: o.code ?? null } }).catch(
    () => undefined,
  );
  window.open(OWNER_PROFILE_URL, "_blank", "noopener,noreferrer");
  return copied;
}

export function BuyButton({
  className,
  children,
  size = "lg",
  ...o
}: Parameters<typeof buyMessage>[0] & {
  className?: string;
  children?: React.ReactNode;
  size?: "default" | "sm" | "lg";
}) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  return (
    <div className="space-y-2">
      <Button
        size={size}
        className={className}
        onClick={async () => setState((await startPurchase(o)) ? "copied" : "manual")}
      >
        <Gem />
        {children ?? `Kup Premium – ${o.price ?? PRICE_LIFETIME_PLN} zł`}
      </Button>
      {state === "copied" && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
          Otworzyłem profil właściciela na Discordzie, a gotową wiadomość masz w schowku – wklej ją
          (Ctrl+V) w rozmowie i opisz płatność.
        </p>
      )}
      {state === "manual" && (
        <p className="text-xs text-muted-foreground">
          Otworzyłem profil właściciela na Discordzie. Napisz tam, że chcesz Premium, i podaj ID
          swojego serwera. (Właściciel: <code>{OWNER_ID}</code>)
        </p>
      )}
    </div>
  );
}

export function PremiumBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[11px] font-bold text-black ${className}`}
    >
      <Gem className="size-3" />
      Premium
    </span>
  );
}

export function LockBanner({
  title,
  children,
  guildId,
  guildName,
}: {
  title: string;
  children?: React.ReactNode;
  guildId?: string;
  guildName?: string;
}) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-4">
      <div className="flex items-center gap-2 font-bold text-amber-900">
        <Lock className="size-4" />
        {title}
      </div>
      {children && <p className="mt-1 text-sm text-amber-900/80">{children}</p>}
      <div className="mt-3">
        <BuyButton size="sm" guildId={guildId ?? null} guildName={guildName ?? null} />
      </div>
    </div>
  );
}
