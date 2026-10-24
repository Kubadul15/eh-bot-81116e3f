import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { adminBulkGrant, adminPremiumCsv, adminServers } from "@/lib/admin.functions";
import { parseIds } from "@/lib/admin-logic";
import { fmtDate, relTime } from "@/lib/format";
import { Card, Empty, ErrorBox, Label, Loading, download, useAdminAction } from "./common";
import { KEY_SERVERS, PlanPills } from "./servers";
import { KEY_OVERVIEW } from "./overview";

/** Klienci Premium: lista, wygasające, eksport CSV do księgowości i hurtowe nadawanie. */
export function PremiumTab({ onOpenServer }: { onOpenServer: (id: string) => void }) {
  const q = useQuery({ queryKey: KEY_SERVERS, queryFn: () => adminServers() });
  const [text, setText] = useState("");
  const [lifetime, setLifetime] = useState(true);
  const [days, setDays] = useState("30");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ ok: string[]; failed: string[] } | null>(null);
  const ids = parseIds(text);
  const csv = useAdminAction(() => adminPremiumCsv(), {
    ok: (r) => `Wyeksportowano ${r.count} klientów`,
  });
  const bulk = useAdminAction(
    () =>
      adminBulkGrant({
        data: {
          text,
          lifetime,
          ...(lifetime ? {} : { days: Math.max(1, Math.floor(Number(days) || 1)) }),
          note,
        },
      }),
    {
      ok: (r) => `Nadano: ${r.ok.length}, błędy: ${r.failed.length}`,
      invalidate: [[...KEY_SERVERS], [...KEY_OVERVIEW]],
    },
  );

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const premium = (q.data ?? []).filter((s) => s.premium.active);
  const soon = premium.filter(
    (s) => s.premium.until && Date.parse(s.premium.until) - Date.now() < 14 * 86_400_000,
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {premium.length} aktywnych klientów Premium • {soon.length} wygasa w 14 dni
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={csv.isPending}
          onClick={() =>
            csv.mutate(undefined, {
              onSuccess: (r) =>
                download(
                  `premium-${new Date().toISOString().slice(0, 10)}.csv`,
                  `﻿${r.csv}`,
                  "text/csv",
                ),
            })
          }
        >
          ⬇️ Eksport CSV (księgowość)
        </Button>
      </div>

      <Card title="Klienci Premium">
        {premium.length === 0 ? (
          <Empty>Nikt jeszcze nie ma Premium. Nadaj plan w zakładce Serwery.</Empty>
        ) : (
          <ul className="divide-y">
            {premium.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => onOpenServer(s.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate font-semibold">{s.name}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {s.id}
                    {s.premium.until
                      ? ` • wygasa ${fmtDate(s.premium.until)} (${relTime(s.premium.until)})`
                      : ""}
                  </span>
                </button>
                <PlanPills s={s} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Hurtowe nadawanie Premium"
        hint="Wklej listę ID serwerów (po spacji, przecinku lub w osobnych liniach). Bot musi być na tych serwerach."
      >
        <div className="space-y-3">
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"1477015035363725596\n1488999134047240325"}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">Rozpoznano {ids.length} ID serwerów.</p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Switch checked={lifetime} onCheckedChange={setLifetime} aria-label="Lifetime" />
              Lifetime
            </label>
            {!lifetime && (
              <div className="w-28">
                <Label>Dni</Label>
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            )}
            <div className="min-w-56 flex-1">
              <Label>Notatka</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="np. moje serwery / partnerzy"
              />
            </div>
          </div>
          <Button
            type="button"
            disabled={!ids.length || bulk.isPending}
            onClick={() => bulk.mutate(undefined, { onSuccess: setResult })}
          >
            Nadaj Premium ({ids.length})
          </Button>
          {result && (
            <p className="text-sm">
              ✅ Nadano: <b>{result.ok.length}</b>
              {result.failed.length > 0 && (
                <>
                  {" "}
                  • ❌ Błędy ({result.failed.length}):{" "}
                  <span className="font-mono text-xs">{result.failed.join(", ")}</span>
                </>
              )}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
