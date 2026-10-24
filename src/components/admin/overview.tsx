import { useQuery } from "@tanstack/react-query";
import { adminOverview } from "@/lib/admin.functions";
import { fmtDateTime, fmtMoney, relTime } from "@/lib/format";
import { Card, Empty, ErrorBox, Loading, Pill, Stat } from "./common";

export const KEY_OVERVIEW = ["admin", "overview"] as const;

export function Overview({ onOpenServer }: { onOpenServer: (id: string) => void }) {
  const q = useQuery({
    queryKey: KEY_OVERVIEW,
    queryFn: () => adminOverview(),
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox error={q.error} />;
  const o = q.data;
  const max = Math.max(1, ...o.monthly.map((m) => m.total));
  return (
    <div className="space-y-6">
      {(o.maintenance || o.notice) && (
        <div className="flex flex-wrap gap-2">
          {o.maintenance && <Pill tone="bad">🛠️ Tryb serwisowy WŁĄCZONY</Pill>}
          {o.notice && <Pill tone="info">📢 Aktywne ogłoszenie: {o.notice.text.slice(0, 60)}</Pill>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Serwery z botem"
          value={o.botGuilds}
          sub={`${o.configured} ma zapisaną konfigurację`}
        />
        <Stat
          label="Premium aktywne"
          value={o.premiumActive}
          tone="good"
          sub={`${o.lifetime} lifetime • ${o.timed} czasowe`}
        />
        <Stat label="Plan Free" value={o.free} sub="potencjalni klienci" />
        <Stat label="Zablokowane" value={o.blocked} tone={o.blocked ? "bad" : undefined} />
        <Stat label="Przychód łącznie" value={fmtMoney(o.revenueTotal)} />
        <Stat label="Ten miesiąc" value={fmtMoney(o.revenueMonth)} tone="good" />
        <Stat label="Aktywne sesje" value={o.sessions} sub="zalogowani w panelu" />
        <Stat
          label="Wygasa w 7 dni"
          value={o.expiringSoon.length}
          tone={o.expiringSoon.length ? "warn" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Przychód – ostatnie 6 miesięcy">
          <div className="flex h-36 items-end gap-3">
            {o.monthly.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-semibold tabular-nums">
                  {m.total ? m.total : ""}
                </span>
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${(m.total / max) * 100}%`, minHeight: m.total ? 4 : 2 }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {m.month.slice(5)}/{m.month.slice(2, 4)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Premium wygasa w ciągu 7 dni" hint="Przypomnij klientom o przedłużeniu.">
          {o.expiringSoon.length === 0 ? (
            <Empty>Nic nie wygasa w najbliższym tygodniu.</Empty>
          ) : (
            <ul className="space-y-2">
              {o.expiringSoon.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onOpenServer(s.id)}
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-xs text-amber-700">{relTime(s.premium.until)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Ostatnie operacje">
        {o.recent.length === 0 ? (
          <Empty>Jeszcze nic się nie wydarzyło.</Empty>
        ) : (
          <ul className="divide-y text-sm">
            {o.recent.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-36 shrink-0 text-xs text-muted-foreground">
                  {fmtDateTime(a.at)}
                </span>
                <Pill>{a.action}</Pill>
                {a.guild && (
                  <button
                    type="button"
                    onClick={() => onOpenServer(a.guild!)}
                    className="font-mono text-xs underline"
                  >
                    {a.guild}
                  </button>
                )}
                <span className="text-muted-foreground">{a.details}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
