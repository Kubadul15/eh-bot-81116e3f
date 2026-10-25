import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  adminAudit,
  adminBlock,
  adminClearPanels,
  adminCopyConfig,
  adminDiagnose,
  adminExportConfig,
  adminForcePanel,
  adminGrant,
  adminImportConfig,
  adminInvite,
  adminLeave,
  adminRemovePayment,
  adminAddPayment,
  adminResetConfig,
  adminRevoke,
  adminSendTo,
  adminServerDetail,
  adminServers,
  adminSetDisabled,
  adminSetFeatures,
  adminSetLimits,
  adminUpdateInfo,
} from "@/lib/admin.functions";
import type { DiagnoseReport, ServerRow } from "@/lib/admin-types";
import {
  FEATURE_GRANTS,
  LIMIT_KEYS,
  LIMIT_LABELS,
  MODULES,
  FREE_LIMITS,
  PREMIUM_LIMITS,
} from "@/lib/premium";
import { PANEL_SLOTS } from "@/lib/bot-slots";
import { fmtDate, fmtDateTime, fmtMoney, relTime } from "@/lib/format";
import {
  Card,
  ConfirmButton,
  Empty,
  ErrorBox,
  Label,
  Loading,
  Pill,
  download,
  useAdminAction,
} from "./common";
import { KEY_OVERVIEW } from "./overview";

export const KEY_SERVERS = ["admin", "servers"] as const;
const keyDetail = (id: string) => ["admin", "server", id] as const;

/** Tworzy jednorazowe zaproszenie (1 h) przez bota, kopiuje link i otwiera go – żeby właściciel mógł wejść na serwer klienta. */
function useInvite() {
  const m = useAdminAction((id: string) => adminInvite({ data: { id } }), {});
  return {
    pending: m.isPending,
    run: (id: string) =>
      m.mutate(id, {
        onSuccess: (r) => {
          void navigator.clipboard.writeText(r.url).catch(() => undefined);
          toast.success(`Zaproszenie gotowe (kanał #${r.channel}, 1 użycie, ważne 1 h): ${r.url}`, {
            duration: 15000,
          });
          window.open(r.url, "_blank", "noopener,noreferrer");
        },
      }),
  };
}

const copy = (text: string) => {
  void navigator.clipboard
    .writeText(text)
    .then(() => toast.success("Skopiowano"))
    .catch(() => toast.error("Nie udało się skopiować"));
};

function Icon({ s, size = 40 }: { s: Pick<ServerRow, "id" | "icon" | "name">; size?: number }) {
  return s.icon ? (
    <img
      src={`https://cdn.discordapp.com/icons/${s.id}/${s.icon}.png?size=96`}
      alt=""
      className="rounded-full"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex items-center justify-center rounded-full bg-secondary font-bold"
      style={{ width: size, height: size }}
    >
      {s.name.replace(/^\(.*?\)\s*/, "")[0] ?? "?"}
    </div>
  );
}

export function PlanPills({
  s,
}: {
  s: Pick<ServerRow, "premium" | "blocked" | "botIn" | "configured">;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {s.premium.active ? (
        <Pill tone="gold">
          {s.premium.lifetime ? "💎 Lifetime" : `💎 do ${fmtDate(s.premium.until)}`}
        </Pill>
      ) : (
        <Pill>Free</Pill>
      )}
      {s.blocked && <Pill tone="bad">⛔ zablokowany</Pill>}
      {!s.botIn && <Pill tone="bad">brak bota</Pill>}
      {s.botIn && !s.configured && <Pill tone="info">bez konfiguracji</Pill>}
    </span>
  );
}

// ====================== LISTA ======================
type Filter = "all" | "premium" | "lifetime" | "timed" | "free" | "blocked" | "nobot" | "noconfig";
const FILTERS: [Filter, string][] = [
  ["all", "Wszystkie"],
  ["premium", "Premium"],
  ["lifetime", "Lifetime"],
  ["timed", "Czasowe"],
  ["free", "Free"],
  ["blocked", "Zablokowane"],
  ["nobot", "Bez bota"],
  ["noconfig", "Bez konfiguracji"],
];

export function Servers({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (selected) return <ServerDetail id={selected} onBack={() => onSelect(null)} />;
  return <ServerList onSelect={onSelect} />;
}

function ServerList({ onSelect }: { onSelect: (id: string) => void }) {
  const q = useQuery({ queryKey: KEY_SERVERS, queryFn: () => adminServers() });
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const invite = useInvite();
  const grant = useAdminAction(
    (id: string) => adminGrant({ data: { id, mode: "lifetime", note: "szybkie nadanie z listy" } }),
    { ok: "Nadano Premium Lifetime", invalidate: [KEY_SERVERS, KEY_OVERVIEW] },
  );

  const rows = useMemo(() => {
    const t = text.trim().toLowerCase();
    return (q.data ?? []).filter((s) => {
      if (t && !`${s.name} ${s.id} ${s.note} ${s.tags.join(" ")}`.toLowerCase().includes(t))
        return false;
      switch (filter) {
        case "premium":
          return s.premium.active;
        case "lifetime":
          return s.premium.lifetime;
        case "timed":
          return s.premium.active && !s.premium.lifetime;
        case "free":
          return s.botIn && !s.premium.active;
        case "blocked":
          return !!s.blocked;
        case "nobot":
          return !s.botIn;
        case "noconfig":
          return s.botIn && !s.configured;
        default:
          return true;
      }
    });
  }, [q.data, text, filter]);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Szukaj po nazwie, ID, notatce, tagu…"
            aria-label="Szukaj serwera"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${filter === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Pokazano {rows.length} z {q.data?.length ?? 0}.
      </p>
      {rows.length === 0 ? (
        <Empty>Brak serwerów dla tych filtrów.</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3"
            >
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Icon s={s} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{s.name}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {s.id}
                    {s.updatedAt ? ` • zmiana ${relTime(s.updatedAt)}` : ""}
                  </span>
                  {s.note && (
                    <span className="block truncate text-xs text-muted-foreground">
                      📝 {s.note}
                    </span>
                  )}
                </span>
              </button>
              <PlanPills s={s} />
              {!s.premium.lifetime && s.botIn && (
                <ConfirmButton
                  size="sm"
                  label="💎 Lifetime"
                  confirmLabel="Nadać Lifetime?"
                  onConfirm={() => grant.mutate(s.id)}
                />
              )}
              {s.botIn && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={invite.pending}
                  onClick={() => invite.run(s.id)}
                  title="Bot utworzy jednorazowe zaproszenie na ten serwer"
                >
                  🔗 Wejdź
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onSelect(s.id)}>
                Otwórz
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ====================== KARTA SERWERA ======================
function ServerDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const q = useQuery({
    queryKey: keyDetail(id),
    queryFn: () => adminServerDetail({ data: { id } }),
  });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data)
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft />
          Wróć
        </Button>
        <ErrorBox error={q.error} />
      </div>
    );
  const s = q.data;
  const invite = useInvite();
  const inv = [keyDetail(id), KEY_SERVERS, KEY_OVERVIEW];
  return (
    <div className="space-y-5">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft />
        Wróć do listy
      </Button>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Icon s={s} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-4xl">{s.name}</h2>
            <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
              {s.id}
              <button type="button" aria-label="Kopiuj ID" onClick={() => copy(s.id)}>
                <Copy className="size-3.5" />
              </button>
              {s.members !== null && <span className="font-sans">👥 {s.members}</span>}
              {s.ownerId && <span className="font-sans">👑 {s.ownerId}</span>}
            </p>
          </div>
          <PlanPills s={s} />
          {s.botIn && (
            <Button type="button" disabled={invite.pending} onClick={() => invite.run(s.id)}>
              🔗 Wejdź na serwer (zaproszenie)
            </Button>
          )}
          {s.botIn && (
            <a
              href={`https://discord.com/channels/${s.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold underline"
            >
              <ExternalLink className="size-4" />
              Jestem już na serwerze
            </a>
          )}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <PremiumCard s={s} inv={inv} />
        <PaymentsCard s={s} inv={inv} />
        <InfoCard s={s} inv={inv} />
        <ModulesCard s={s} inv={inv} />
        <FeaturesCard s={s} inv={inv} />
        <LimitsCard s={s} inv={inv} />
        <BlockCard s={s} inv={inv} />
        <ConfigCard s={s} inv={inv} onBack={onBack} />
        <MessageCard s={s} />
      </div>
      <ServerAudit id={id} />
    </div>
  );
}

type D = NonNullable<
  ReturnType<typeof useQuery<Awaited<ReturnType<typeof adminServerDetail>>>>["data"]
>;
type CardProps = { s: D; inv: readonly (readonly string[])[] };
const invKeys = (inv: CardProps["inv"]) => inv.map((k) => [...k]);

function PremiumCard({ s, inv }: CardProps) {
  const [days, setDays] = useState("30");
  const [note, setNote] = useState("");
  const base = { invalidate: invKeys(inv) };
  const lifetime = useAdminAction(
    () => adminGrant({ data: { id: s.id, mode: "lifetime", note } }),
    { ...base, ok: "Nadano Premium Lifetime" },
  );
  const timed = useAdminAction(
    (mode: "days" | "extend") =>
      adminGrant({
        data: { id: s.id, mode, days: Math.max(1, Math.floor(Number(days) || 1)), note },
      }),
    { ...base, ok: "Zapisano Premium" },
  );
  const revoke = useAdminAction(() => adminRevoke({ data: { id: s.id } }), {
    ...base,
    ok: "Cofnięto Premium",
  });
  return (
    <Card
      title="💎 Plan Premium"
      hint={
        s.premium.active
          ? s.premium.lifetime
            ? "Aktywny na zawsze."
            : `Aktywny do ${fmtDateTime(s.premium.until)} (${relTime(s.premium.until)}).`
          : "Plan Free. Nadaj Premium po otrzymaniu płatności."
      }
    >
      {s.grant && (
        <p className="mb-3 text-xs text-muted-foreground">
          Od {fmtDate(s.grant.since)} • źródło: {s.grant.source}
          {s.grant.note ? ` • „${s.grant.note}”` : ""}
        </p>
      )}
      <div className="space-y-3">
        <div>
          <Label>Notatka do nadania (np. BLIK 20 zł)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </div>
        <div className="flex flex-wrap gap-2">
          <ConfirmButton
            label="♾️ Nadaj Lifetime"
            confirmLabel="Potwierdź Lifetime"
            onConfirm={() => lifetime.mutate()}
            variant="default"
          />
          <ConfirmButton
            label="Cofnij Premium"
            confirmLabel="Na pewno cofnąć?"
            onConfirm={() => revoke.mutate()}
            disabled={!s.grant}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
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
          <Button type="button" variant="outline" onClick={() => timed.mutate("days")}>
            Nadaj na X dni
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => timed.mutate("extend")}
            disabled={!s.premium.active || s.premium.lifetime}
          >
            Przedłuż o X dni
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PaymentsCard({ s, inv }: CardProps) {
  const [amount, setAmount] = useState("20");
  const [method, setMethod] = useState("BLIK");
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const total = s.payments.reduce((n, p) => n + p.amount, 0);
  const base = { invalidate: invKeys(inv) };
  const add = useAdminAction(
    () =>
      adminAddPayment({
        data: {
          id: s.id,
          amount: Number(amount.replace(",", ".")),
          method,
          note,
          ...(code.trim() ? { code: code.trim() } : {}),
        },
      }),
    { ...base, ok: "Zapisano płatność" },
  );
  const del = useAdminAction(
    (paymentId: string) => adminRemovePayment({ data: { id: s.id, paymentId } }),
    { ...base, ok: "Usunięto płatność" },
  );
  return (
    <Card
      title={`💳 Płatności (${fmtMoney(total)})`}
      hint="Rejestr do księgowości; trafia do statystyk przychodu i eksportu CSV."
    >
      <div className="grid gap-2 sm:grid-cols-[90px_1fr_1fr]">
        <div>
          <Label>Kwota</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <Label>Metoda</Label>
          <Input
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            maxLength={40}
            list="pay-methods"
          />
          <datalist id="pay-methods">
            <option value="BLIK" />
            <option value="PayPal" />
            <option value="Przelew" />
            <option value="Paysafecard" />
            <option value="Inne" />
          </datalist>
        </div>
        <div>
          <Label>Kod rabatowy</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={32}
            placeholder="opcjonalnie"
          />
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={120}
          placeholder="Notatka do płatności"
        />
        <Button type="button" onClick={() => add.mutate()} disabled={add.isPending}>
          Dodaj
        </Button>
      </div>
      {s.payments.length > 0 && (
        <ul className="mt-4 divide-y text-sm">
          {s.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                <b>{fmtMoney(p.amount)}</b> • {p.method} • {fmtDate(p.at)}
                {p.note ? <span className="text-muted-foreground"> • {p.note}</span> : null}
              </span>
              <ConfirmButton
                size="sm"
                variant="ghost"
                label="Usuń"
                confirmLabel="Usunąć?"
                onConfirm={() => del.mutate(p.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function InfoCard({ s, inv }: CardProps) {
  const [note, setNote] = useState(s.note);
  const [contact, setContact] = useState(s.contact);
  const [tags, setTags] = useState(s.tags.join(", "));
  const save = useAdminAction(
    () =>
      adminUpdateInfo({
        data: {
          id: s.id,
          note,
          contact,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    { ok: "Zapisano informacje", invalidate: invKeys(inv) },
  );
  return (
    <Card title="📝 Klient: notatka, kontakt, tagi" hint="Widoczne tylko dla Ciebie.">
      <div className="space-y-3">
        <div>
          <Label>Kontakt (np. nick na Discordzie, mail)</Label>
          <Input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} />
        </div>
        <div>
          <Label>Notatka</Label>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </div>
        <div>
          <Label>Tagi (po przecinku)</Label>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="vip, polecony, partner"
          />
        </div>
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          Zapisz
        </Button>
      </div>
    </Card>
  );
}

function ModulesCard({ s, inv }: CardProps) {
  const [off, setOff] = useState<string[]>(s.disabledModules);
  const save = useAdminAction(() => adminSetDisabled({ data: { id: s.id, modules: off } }), {
    ok: "Zapisano moduły",
    invalidate: invKeys(inv),
  });
  return (
    <Card
      title="🧩 Moduły bota na tym serwerze"
      hint="Zaznaczone moduły są WYŁĄCZONE (komendy odpowiadają, że funkcja jest niedostępna)."
    >
      <div className="grid gap-1.5 sm:grid-cols-2">
        {MODULES.map(([mid, label]) => (
          <label
            key={mid}
            className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={off.includes(mid)}
              onChange={(e) =>
                setOff((o) => (e.target.checked ? [...o, mid] : o.filter((x) => x !== mid)))
              }
            />
            {label}
          </label>
        ))}
      </div>
      <Button
        type="button"
        className="mt-3"
        onClick={() => save.mutate()}
        disabled={save.isPending}
      >
        Zapisz
      </Button>
    </Card>
  );
}

function LimitsCard({ s, inv }: CardProps) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      LIMIT_KEYS.map((k) => [k, s.limits[k] !== undefined ? String(s.limits[k]) : ""]),
    ),
  );
  const save = useAdminAction(
    () =>
      adminSetLimits({
        data: {
          id: s.id,
          limits: Object.fromEntries(
            Object.entries(vals)
              .filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v)))
              .map(([k, v]) => [k, Number(v)]),
          ),
        },
      }),
    { ok: "Zapisano limity", invalidate: invKeys(inv) },
  );
  return (
    <Card
      title="📏 Limity (nadpisanie)"
      hint="Puste pole = limit z planu. Wpisz własną wartość, np. gdy chcesz komuś dać więcej stanowisk bez Premium."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {LIMIT_KEYS.map((k) => (
          <div key={k}>
            <Label>{LIMIT_LABELS[k]}</Label>
            <Input
              type="number"
              min={0}
              value={vals[k] ?? ""}
              onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
              placeholder={`Free ${FREE_LIMITS[k]} • Premium ${PREMIUM_LIMITS[k] >= 100_000 ? "∞" : PREMIUM_LIMITS[k]}`}
            />
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Obowiązuje teraz:{" "}
              {s.effectiveLimits[k] >= 100_000 ? "bez limitu" : s.effectiveLimits[k]}
            </p>
          </div>
        ))}
      </div>
      <Button
        type="button"
        className="mt-3"
        onClick={() => save.mutate()}
        disabled={save.isPending}
      >
        Zapisz limity
      </Button>
    </Card>
  );
}

function BlockCard({ s, inv }: CardProps) {
  const [reason, setReason] = useState("");
  const set = useAdminAction(
    (block: boolean) => adminBlock({ data: { id: s.id, block, reason } }),
    { ok: (r) => (r ? "Zapisano" : "Zapisano"), invalidate: invKeys(inv) },
  );
  return (
    <Card
      title="⛔ Blokada serwera"
      hint="Zablokowany serwer: bot odmawia komend, panel nie pozwala zapisywać zmian."
    >
      {s.blockedInfo ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-red-500/40 bg-red-50 p-3 text-sm text-red-800">
            Zablokowany {fmtDateTime(s.blockedInfo.at)}: <b>{s.blockedInfo.reason}</b>
          </p>
          <Button type="button" onClick={() => set.mutate(false)}>
            Odblokuj serwer
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <Label>Powód (widzą go użytkownicy)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </div>
          <ConfirmButton
            label="Zablokuj"
            confirmLabel="Potwierdź blokadę"
            disabled={!reason.trim()}
            onConfirm={() => set.mutate(true)}
          />
        </div>
      )}
    </Card>
  );
}

function ConfigCard({ s, inv, onBack }: CardProps & { onBack: () => void }) {
  const [json, setJson] = useState("");
  const [panel, setPanel] = useState<string>(PANEL_SLOTS[0].key);
  const [from, setFrom] = useState("");
  const [report, setReport] = useState<DiagnoseReport | null>(null);
  const servers = useQuery({ queryKey: KEY_SERVERS, queryFn: () => adminServers() });
  const base = { invalidate: invKeys(inv) };
  const exp = useAdminAction(() => adminExportConfig({ data: { id: s.id } }), {
    ok: "Pobrano konfigurację",
  });
  const imp = useAdminAction(() => adminImportConfig({ data: { id: s.id, json } }), {
    ...base,
    ok: "Zaimportowano konfigurację",
  });
  const reset = useAdminAction(() => adminResetConfig({ data: { id: s.id } }), {
    ...base,
    ok: "Zresetowano konfigurację",
  });
  const clear = useAdminAction(() => adminClearPanels({ data: { id: s.id } }), {
    ...base,
    ok: "Wyczyszczono oczekujące panele",
  });
  const force = useAdminAction(() => adminForcePanel({ data: { id: s.id, panel } }), {
    ...base,
    ok: "Zlecono wysyłkę panelu",
  });
  const cp = useAdminAction(() => adminCopyConfig({ data: { from, to: s.id } }), {
    ...base,
    ok: "Skopiowano ustawienia i wiadomości",
  });
  const diag = useAdminAction(() => adminDiagnose({ data: { id: s.id } }), {
    ok: "Diagnoza gotowa",
  });
  const leave = useAdminAction(() => adminLeave({ data: { id: s.id, confirm: true } }), {
    ok: "Bot opuścił serwer",
    invalidate: invKeys(inv),
  });
  return (
    <Card
      title="⚙️ Konfiguracja i diagnostyka"
      hint={`Kanały ustawione: ${s.channelsSet} • rangi: ${s.rolesSet}${s.pendingPanels.length ? ` • oczekujące panele: ${s.pendingPanels.join(", ")}` : ""}`}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={diag.isPending || !s.botIn}
            onClick={() => diag.mutate(undefined, { onSuccess: setReport })}
          >
            🩺 Diagnoza
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!s.configured}
            onClick={() =>
              exp.mutate(undefined, {
                onSuccess: (r) => download(`konfiguracja-${s.id}.json`, JSON.stringify(r, null, 2)),
              })
            }
          >
            ⬇️ Eksport JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => clear.mutate()}
            disabled={!s.pendingPanels.length}
          >
            Wyczyść oczekujące panele
          </Button>
        </div>

        {report && (
          <div className="rounded-lg border p-3 text-sm">
            {!report.botIn ? (
              <p className="font-semibold text-destructive">
                Bota nie ma na tym serwerze albo brak dostępu.
              </p>
            ) : (
              <>
                <p className="font-semibold">Uprawnienia bota</p>
                <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
                  {report.permissions.map((p) => (
                    <li key={p.name}>
                      {p.ok ? "✅" : "❌"} {p.name}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-semibold">
                  Kanały: {report.okChannels} OK
                  {report.missingChannels.length
                    ? `, ${report.missingChannels.length} problem`
                    : ""}{" "}
                  • Rangi: {report.okRoles} OK
                  {report.missingRoles.length ? `, ${report.missingRoles.length} brak` : ""}
                </p>
                <ul className="mt-1 text-xs text-destructive">
                  {report.missingChannels.map((c) => (
                    <li key={c.key}>
                      #{c.key} ({c.id}): {c.reason}
                    </li>
                  ))}
                  {report.missingRoles.map((r) => (
                    <li key={r.key + r.id}>
                      ranga „{r.key}” ({r.id}) nie istnieje
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
          <div>
            <Label>Wymuś wysłanie panelu</Label>
            <select
              className="editor-select"
              value={panel}
              onChange={(e) => setPanel(e.target.value)}
            >
              {PANEL_SLOTS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.emoji} {p.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="outline" onClick={() => force.mutate()}>
            Wyślij
          </Button>
        </div>

        <div className="border-t pt-3">
          <Label>Kopiuj ustawienia i wiadomości z innego serwera (bez kanałów i rang)</Label>
          <div className="flex gap-2">
            <select
              className="editor-select"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              <option value="">— wybierz źródło —</option>
              {(servers.data ?? [])
                .filter((x) => x.id !== s.id && x.configured)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
            <ConfirmButton
              label="Kopiuj"
              confirmLabel="Nadpisać?"
              disabled={!from}
              onConfirm={() => cp.mutate()}
            />
          </div>
        </div>

        <div className="border-t pt-3">
          <Label>Import konfiguracji (wklej JSON z eksportu)</Label>
          <Textarea
            rows={4}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{"channels":{…},"roles":{…},"settings":{…},"content":{…}}'
            className="font-mono text-xs"
          />
          <div className="mt-2">
            <ConfirmButton
              label="Importuj"
              confirmLabel="Nadpisać konfigurację?"
              disabled={!json.trim()}
              onConfirm={() => imp.mutate()}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <ConfirmButton
            label="🗑️ Zresetuj konfigurację"
            confirmLabel="Usunąć kanały, rangi i treści?"
            disabled={!s.configured}
            onConfirm={() => reset.mutate()}
          />
          <ConfirmButton
            label="🚪 Bot opuszcza serwer"
            confirmLabel="Naprawdę wyjść z serwera?"
            disabled={!s.botIn}
            onConfirm={() => leave.mutate(undefined, { onSuccess: onBack })}
          />
        </div>
      </div>
    </Card>
  );
}

function MessageCard({ s }: { s: D }) {
  const [channelId, setChannelId] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [color, setColor] = useState("#5865f2");
  const send = useAdminAction(
    () => adminSendTo({ data: { id: s.id, channelId: channelId.trim(), title, text, color } }),
    { ok: "Wysłano wiadomość" },
  );
  return (
    <Card
      title="📣 Wiadomość od bota na ten serwer"
      hint="Np. informacja o awarii lub potwierdzenie zakupu. Wklej ID kanału (PPM na kanale → Kopiuj ID)."
    >
      <div className="space-y-2">
        <div>
          <Label>ID kanału</Label>
          <Input
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="18–20 cyfr"
            inputMode="numeric"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
          <div>
            <Label>Tytuł</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={256} />
          </div>
          <div>
            <Label>Kolor</Label>
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 p-1"
            />
          </div>
        </div>
        <div>
          <Label>Treść</Label>
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
          />
        </div>
        <Button
          type="button"
          onClick={() => send.mutate()}
          disabled={send.isPending || !channelId.trim() || (!title.trim() && !text.trim())}
        >
          Wyślij
        </Button>
      </div>
    </Card>
  );
}

function ServerAudit({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["admin", "audit", id],
    queryFn: () => adminAudit({ data: { guild: id, limit: 50 } }),
  });
  return (
    <Card title="📜 Historia operacji na tym serwerze">
      {q.isLoading ? (
        <Loading />
      ) : (q.data ?? []).length === 0 ? (
        <Empty>Brak wpisów.</Empty>
      ) : (
        <ul className="divide-y text-sm">
          {(q.data ?? []).map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 py-1.5">
              <span className="w-36 text-xs text-muted-foreground">{fmtDateTime(a.at)}</span>
              <Pill>{a.action}</Pill>
              <span className="text-muted-foreground">{a.details}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FeaturesCard({ s, inv }: CardProps) {
  const [on, setOn] = useState<string[]>(s.features);
  const save = useAdminAction(() => adminSetFeatures({ data: { id: s.id, features: on } }), {
    ok: "Zapisano funkcje dodatkowe",
    invalidate: invKeys(inv),
  });
  return (
    <Card
      title="🎁 Funkcje dodatkowe (nadajesz Ty)"
      hint="Zaznaczone funkcje działają na tym serwerze nawet bez Premium – np. jako prezent albo test dla klienta."
    >
      <div className="space-y-1.5">
        {FEATURE_GRANTS.map(([fid, label]) => (
          <label
            key={fid}
            className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={on.includes(fid)}
              onChange={(e) =>
                setOn((o) => (e.target.checked ? [...o, fid] : o.filter((x) => x !== fid)))
              }
            />
            {label}
            {s.premium.active && (
              <span className="ml-auto text-xs text-muted-foreground">i tak aktywne (Premium)</span>
            )}
          </label>
        ))}
      </div>
      <Button
        type="button"
        className="mt-3"
        onClick={() => save.mutate()}
        disabled={save.isPending}
      >
        Zapisz
      </Button>
    </Card>
  );
}
