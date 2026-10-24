import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  adminBroadcast,
  adminClearNotice,
  adminOverview,
  adminSetMaintenance,
  adminSetNotice,
} from "@/lib/admin.functions";
import { Card, ConfirmButton, Label, Pill, useAdminAction } from "./common";
import { KEY_OVERVIEW } from "./overview";

/** Ogłoszenie na stronie, tryb serwisowy i ogłoszenie masowe na serwery z botem. */
export function NoticesTab() {
  const ov = useQuery({ queryKey: KEY_OVERVIEW, queryFn: () => adminOverview() });
  const inv = { invalidate: [[...KEY_OVERVIEW], ["public-notice"]] };
  const [text, setText] = useState("");
  const [level, setLevel] = useState<"info" | "warn" | "danger">("info");
  const [days, setDays] = useState("7");
  const [bTitle, setBTitle] = useState("");
  const [bText, setBText] = useState("");
  const [scope, setScope] = useState<"all" | "premium" | "free">("all");
  const [result, setResult] = useState<{ sent: number; skipped: string[] } | null>(null);

  const setNotice = useAdminAction(
    () =>
      adminSetNotice({
        data: { text, level, days: days.trim() ? Math.floor(Number(days)) : null },
      }),
    { ...inv, ok: "Ogłoszenie opublikowane" },
  );
  const clear = useAdminAction(() => adminClearNotice(), { ...inv, ok: "Usunięto ogłoszenie" });
  const maint = useAdminAction((on: boolean) => adminSetMaintenance({ data: { on } }), {
    ...inv,
    ok: (r) => (r ? "Zapisano" : "Zapisano"),
  });
  const broadcast = useAdminAction(
    () => adminBroadcast({ data: { scope, title: bTitle, text: bText, confirm: true } }),
    { ok: (r) => `Wysłano na ${r.sent} serwerów` },
  );
  const o = ov.data;

  return (
    <div className="space-y-5">
      <Card
        title="📢 Ogłoszenie na stronie"
        hint="Pasek u góry każdej strony (cennik, dashboard, panel)."
      >
        {o?.notice && (
          <p className="mb-3 rounded-lg border p-3 text-sm">
            Aktywne: <b>{o.notice.text}</b> <Pill tone="info">{o.notice.level}</Pill>
          </p>
        )}
        <div className="space-y-3">
          <div>
            <Label>Treść (max 300 znaków)</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              placeholder="np. Dziś o 22:00 krótka przerwa techniczna"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Rodzaj</Label>
              <select
                className="editor-select"
                value={level}
                onChange={(e) => setLevel(e.target.value as typeof level)}
              >
                <option value="info">ℹ️ Informacja</option>
                <option value="warn">⚠️ Ostrzeżenie</option>
                <option value="danger">🚨 Pilne</option>
              </select>
            </div>
            <div className="w-28">
              <Label>Ważne dni</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="bez końca"
              />
            </div>
            <Button
              type="button"
              onClick={() => setNotice.mutate()}
              disabled={!text.trim() || setNotice.isPending}
            >
              Opublikuj
            </Button>
            {o?.notice && (
              <Button type="button" variant="outline" onClick={() => clear.mutate()}>
                Usuń ogłoszenie
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card
        title="🛠️ Tryb serwisowy"
        hint="Gdy włączony: klienci nie mogą zapisywać zmian w panelu (Ty możesz). Na stronie pojawia się żółty pasek."
      >
        <label className="flex items-center gap-3 text-sm font-semibold">
          <Switch
            checked={!!o?.maintenance}
            onCheckedChange={(on) => maint.mutate(on)}
            aria-label="Tryb serwisowy"
          />
          {o?.maintenance ? "WŁĄCZONY – zapisy klientów zablokowane" : "Wyłączony"}
        </label>
      </Card>

      <Card
        title="📨 Ogłoszenie masowe na serwery"
        hint="Wysyła embed na kanał systemowy każdego wybranego serwera (ten od powitań). Serwery bez takiego kanału są pomijane."
      >
        <div className="space-y-3">
          <div>
            <Label>Do kogo</Label>
            <select
              className="editor-select"
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
            >
              <option value="all">Wszystkie serwery z botem</option>
              <option value="premium">Tylko Premium</option>
              <option value="free">Tylko Free (np. oferta)</option>
            </select>
          </div>
          <div>
            <Label>Tytuł</Label>
            <Input value={bTitle} onChange={(e) => setBTitle(e.target.value)} maxLength={256} />
          </div>
          <div>
            <Label>Treść</Label>
            <Textarea
              rows={4}
              value={bText}
              onChange={(e) => setBText(e.target.value)}
              maxLength={4000}
            />
          </div>
          <ConfirmButton
            label="Wyślij ogłoszenie"
            confirmLabel="Wysłać na wiele serwerów?"
            disabled={bText.trim().length < 3 || broadcast.isPending}
            onConfirm={() => broadcast.mutate(undefined, { onSuccess: setResult })}
            variant="default"
          />
          {result && (
            <div className="rounded-lg border p-3 text-sm">
              ✅ Wysłano: <b>{result.sent}</b>
              {result.skipped.length > 0 && (
                <>
                  <p className="mt-2 font-semibold">Pominięto ({result.skipped.length}):</p>
                  <ul className="text-xs text-muted-foreground">
                    {result.skipped.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
