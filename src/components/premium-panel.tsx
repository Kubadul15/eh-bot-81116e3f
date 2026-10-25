import { Check, Gem, Minus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BuyButton, PremiumBadge, TrialCard } from "@/components/premium-ui";
import {
  COMPARISON,
  LIMIT_LABELS,
  PRICE_LIFETIME_PLN,
  type Limits,
  type PublicPremium,
} from "@/lib/premium";
import { fmtDate } from "@/lib/format";

// Zakładka „Premium” w panelu serwera: status planu, wykorzystanie limitów i co daje Premium.
export function PremiumPanel({
  premium,
  guildId,
  guildName,
  usage,
  onStartTrial,
}: {
  premium: PublicPremium;
  guildId: string;
  guildName: string;
  usage: Partial<Record<keyof Limits, number>>;
  /** uruchamia bezpłatny trial; po sukcesie dane serwera są odświeżane */
  onStartTrial?: () => Promise<void>;
}) {
  const free = !premium.active;
  return (
    <div className="animate-fade-up">
      <h2 className="font-display text-4xl">💎 Premium</h2>

      {premium.blocked && (
        <div className="mt-4 rounded-xl border border-red-500/50 bg-red-50 p-4 text-sm font-semibold text-red-800">
          ⛔ Ten serwer jest zablokowany przez właściciela bota: {premium.blocked.reason}. Zapisy w
          panelu i działanie bota są wstrzymane.
        </div>
      )}

      {free && premium.trial.available && onStartTrial && (
        <div className="mt-4">
          <TrialCard days={premium.trial.days} onStart={onStartTrial} />
        </div>
      )}
      {premium.trial.active && (
        <div className="mt-4 rounded-xl border border-emerald-500/50 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          🎁 Trwa bezpłatny trial Premium – zostało {premium.trial.daysLeft}{" "}
          {premium.trial.daysLeft === 1 ? "dzień" : "dni"} (do{" "}
          {premium.until ? fmtDate(premium.until) : "?"}). Po tym czasie serwer wraca do planu Free,
          a dane zostają. Kup Premium, żeby zachować wszystkie funkcje.
        </div>
      )}
      {free && premium.trial.used && !premium.trial.active && (
        <p className="mt-4 text-sm text-muted-foreground">
          Bezpłatny trial na tym serwerze został już wykorzystany.
        </p>
      )}

      <div
        className={`mt-4 rounded-2xl border-2 p-6 ${free ? "bg-card" : "border-amber-500 bg-gradient-to-b from-amber-50 to-card"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Plan serwera {guildName}
            </p>
            <p className="mt-1 font-display text-5xl">
              {free
                ? "Free"
                : premium.lifetime
                  ? "Premium Lifetime"
                  : premium.trial.active
                    ? "Premium (trial)"
                    : "Premium"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {free
                ? "Podstawowe funkcje z limitami. Odblokuj sąd, kasyno, captcha i własny wygląd jedną płatnością."
                : premium.lifetime
                  ? "Aktywne na zawsze – dziękujemy za wsparcie! 🎉"
                  : premium.trial.active
                    ? `Okres próbny do ${premium.until ? fmtDate(premium.until) : "?"}. Kup Premium, żeby zachować funkcje.`
                    : `Aktywne do ${premium.until ? fmtDate(premium.until) : "?"}. Przed wygaśnięciem napisz do właściciela o przedłużenie.`}
            </p>
          </div>
          {free ? (
            <div className="w-full sm:w-auto">
              <BuyButton guildId={guildId} guildName={guildName} />
              <p className="mt-2 text-xs text-muted-foreground">
                {PRICE_LIFETIME_PLN} zł jednorazowo •{" "}
                <Link to="/pricing" className="underline">
                  szczegóły i kod rabatowy
                </Link>
              </p>
            </div>
          ) : (
            <PremiumBadge className="px-3 py-1 text-sm" />
          )}
        </div>
      </div>

      <h3 className="mt-8 font-display text-3xl">Wykorzystanie limitów</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(Object.keys(LIMIT_LABELS) as (keyof Limits)[]).map((k) => {
          const max = premium.limits[k],
            used = usage[k];
          const unlimited = max >= 100_000;
          const pct =
            used !== undefined && !unlimited && max > 0
              ? Math.min(100, Math.round((used / max) * 100))
              : 0;
          return (
            <div key={k} className="rounded-lg border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{LIMIT_LABELS[k]}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {used !== undefined ? `${used} / ` : ""}
                  {unlimited ? "bez limitu" : max}
                </span>
              </div>
              {used !== undefined && !unlimited && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary/70"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mt-8 font-display text-3xl">Co obejmuje plan</h3>
      <div className="mt-3 overflow-hidden rounded-xl border bg-card">
        {COMPARISON.map((r) => {
          const has = free ? r.free : r.premium;
          return (
            <div
              key={r.label}
              className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0"
            >
              {has === false ? (
                <Minus className="size-4 shrink-0 text-muted-foreground/50" />
              ) : (
                <Check className="size-4 shrink-0 text-emerald-600" />
              )}
              <span className={has === false ? "text-muted-foreground" : ""}>{r.label}</span>
              {typeof has === "string" && (
                <span className="ml-auto text-xs font-semibold text-muted-foreground">{has}</span>
              )}
              {free && r.free === false && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                  <Gem className="size-3" />
                  Premium
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
