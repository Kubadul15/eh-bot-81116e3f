import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminCodes, adminCreateCode, adminDeleteCode } from "@/lib/admin.functions";
import { codeUsable } from "@/lib/admin-logic";
import { PRICE_LIFETIME_PLN, priceWithDiscount } from "@/lib/premium";
import { fmtDate } from "@/lib/format";
import {
  Card,
  ConfirmButton,
  Empty,
  ErrorBox,
  Label,
  Loading,
  Pill,
  useAdminAction,
} from "./common";

const KEY = ["admin", "codes"] as const;

/** Kody rabatowe: klient wpisuje je na stronie Cennik, a Ty widzisz je w wiadomości od klienta i w dzienniku. */
export function CodesTab() {
  const q = useQuery({ queryKey: KEY, queryFn: () => adminCodes() });
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("20");
  const [maxUses, setMaxUses] = useState("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const create = useAdminAction(
    () =>
      adminCreateCode({
        data: {
          ...(code.trim() ? { code: code.trim() } : {}),
          percent: Number(percent),
          maxUses: maxUses.trim() ? Number(maxUses) : null,
          days: days.trim() ? Number(days) : null,
          note,
        },
      }),
    { ok: (c) => `Utworzono kod ${c.code}`, invalidate: [[...KEY]] },
  );
  const del = useAdminAction((c: string) => adminDeleteCode({ data: { code: c } }), {
    ok: "Usunięto kod",
    invalidate: [[...KEY]],
  });

  return (
    <div className="space-y-5">
      <Card
        title="Nowy kod rabatowy"
        hint="Zostaw pole „Kod” puste, żeby wygenerować losowy (np. EHB-7K2M9QXA)."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Kod</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={32}
              placeholder="losowy"
            />
          </div>
          <div>
            <Label>Rabat %</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </div>
          <div>
            <Label>Limit użyć</Label>
            <Input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="bez limitu"
            />
          </div>
          <div>
            <Label>Ważny dni</Label>
            <Input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="bez końca"
            />
          </div>
          <div>
            <Label>Notatka</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              placeholder="np. dla partnera"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Cena po rabacie: <b>{priceWithDiscount(Number(percent) || 0)} zł</b> (zamiast{" "}
          {PRICE_LIFETIME_PLN} zł).
        </p>
        <Button
          type="button"
          className="mt-3"
          onClick={() => create.mutate()}
          disabled={create.isPending}
        >
          Utwórz kod
        </Button>
      </Card>

      <Card title="Kody">
        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <ErrorBox error={q.error} />
        ) : (q.data ?? []).length === 0 ? (
          <Empty>Brak kodów.</Empty>
        ) : (
          <ul className="divide-y">
            {(q.data ?? []).map((c) => {
              const u = codeUsable(c);
              return (
                <li key={c.code} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <button
                    type="button"
                    aria-label="Kopiuj kod"
                    onClick={() => {
                      void navigator.clipboard.writeText(c.code);
                      toast.success("Skopiowano kod");
                    }}
                    className="inline-flex items-center gap-1.5 font-mono font-bold"
                  >
                    <Copy className="size-3.5" />
                    {c.code}
                  </button>
                  <Pill tone="gold">−{c.percent}%</Pill>
                  <span className="text-muted-foreground">
                    użyto {c.used}
                    {c.maxUses !== null ? `/${c.maxUses}` : ""}
                    {c.expiresAt ? ` • do ${fmtDate(c.expiresAt)}` : ""}
                    {c.note ? ` • ${c.note}` : ""}
                  </span>
                  {!u.ok && <Pill tone="bad">{u.reason}</Pill>}
                  <span className="ml-auto">
                    <ConfirmButton
                      size="sm"
                      variant="ghost"
                      label="Usuń"
                      confirmLabel="Usunąć?"
                      onConfirm={() => del.mutate(c.code)}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
