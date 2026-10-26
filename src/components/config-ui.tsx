import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChannelSlot, RoleField } from "@/lib/bot-slots";
import { useI18n } from "@/lib/i18n-react";

export type DRole = { id: string; name: string; color: number };
export type DChannel = { id: string; name: string; type: number };

const hex = (c: number) => (c ? `#${c.toString(16).padStart(6, "0")}` : "#99aab5");

// Pasek postępu "X z Y ustawione"
export function Progress({ done, total }: { done: number; total: number }) {
  const { t } = useI18n();
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className="flex items-center gap-2"
      title={t("{done} z {total} ustawione", { done, total })}
    >
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-600" : "bg-primary/70"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}

function StateBadge({ on, onText, offText }: { on: boolean; onText: string; offText: string }) {
  return on ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
      <Check className="size-3" strokeWidth={3} />
      {onText}
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
      {offText}
    </span>
  );
}

// Wybór rang: u góry WYBRANE (zielone, z ptaszkiem i krzyżykiem), niżej DOSTĘPNE (obrys, plus) z wyszukiwarką.
export function RolePicker({
  field,
  roles,
  selected,
  onToggle,
}: {
  field: RoleField;
  roles: DRole[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const chosen = selected.map((id) => byId.get(id) ?? { id, name: "(usunięta ranga)", color: 0 });
  const needle = q.trim().toLowerCase();
  const available = roles.filter(
    (r) => !selected.includes(r.id) && r.name.toLowerCase().includes(needle),
  );
  return (
    <div
      className={`rounded-xl border bg-card p-5 ${chosen.length ? "border-emerald-500/60" : ""}`}
      data-testid={`role-${field.key}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold">{t(field.label)}</h4>
          <p className="text-xs text-muted-foreground">{t(field.desc)}</p>
        </div>
        <StateBadge
          on={chosen.length > 0}
          onText={field.multi ? t("Wybrano: {length}", { length: chosen.length }) : t("Wybrano")}
          offText={t("Nie wybrano")}
        />
      </div>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
        {t("✓ Wybrane")}
      </p>
      <div className="mt-1.5 flex min-h-11 flex-wrap gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 p-2">
        {chosen.length === 0 && (
          <span className="px-1 py-1.5 text-sm text-muted-foreground">
            {t("Nic nie wybrano – kliknij rangę z listy poniżej.")}
          </span>
        )}
        {chosen.map((r, i) => (
          <button
            key={r.id}
            type="button"
            aria-pressed="true"
            title={t("Kliknij, aby odznaczyć")}
            onClick={() => onToggle(r.id)}
            className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-600 py-1 pl-2.5 pr-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
          >
            <Check className="size-3.5" strokeWidth={3} />
            {field.ordered && <span className="tabular-nums opacity-80">{i + 1}.</span>}
            <span
              className="size-2.5 rounded-full ring-2 ring-white/70"
              style={{ background: hex(r.color) }}
            />
            {r.name}
            <X className="size-3.5 opacity-60 transition group-hover:opacity-100" />
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("Dostępne rangi (")}
          {available.length})
        </p>
        {roles.length > 8 && (
          <label className="relative block w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Szukaj rangi…")}
              aria-label={t("Szukaj rangi: {label}", { label: t(field.label) })}
              className="w-full rounded-md border bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </label>
        )}
      </div>
      <div className="mt-1.5 flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
        {available.length === 0 && (
          <span className="text-sm text-muted-foreground">
            {needle ? t("Brak pasujących rang.") : t("Wszystkie rangi są już wybrane.")}
          </span>
        )}
        {available.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed="false"
            onClick={() => onToggle(r.id)}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-sm text-foreground/80 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-foreground active:scale-95"
          >
            <span className="size-2.5 rounded-full" style={{ background: hex(r.color) }} />
            {r.name}
            <Plus className="size-3.5 opacity-50" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChannelField({
  slot,
  value,
  options,
  category,
  onChange,
}: {
  slot: ChannelSlot;
  value: string;
  options: DChannel[];
  category?: boolean;
  onChange: (id: string) => void;
}) {
  const { t } = useI18n();
  const [, emoji, label, desc] = slot;
  const on = !!value && options.some((c) => c.id === value);
  return (
    <label
      className={`block rounded-lg border p-4 transition ${on ? "border-emerald-500/50 bg-emerald-50/50" : "bg-card"}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold">
          {emoji} {t(label)}
        </span>
        <StateBadge on={on} onText={t("Ustawiono")} offText={t("Nie ustawiono")} />
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{t(desc)}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
      >
        <option value="">{t("— nie ustawiono —")}</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {category ? "📁 " : "# "}
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextField({
  label,
  hint,
  value,
  placeholder,
  max = 500,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  max?: number;
  onChange: (v: string) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="block rounded-lg border bg-card p-4 sm:col-span-2">
      <span className="text-sm font-semibold">{t(label)}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{t(hint)}</span>}
      <input
        type="url"
        maxLength={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}

export function NumField({
  label,
  value,
  min = 1,
  max = 365,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="block rounded-lg border bg-card p-4">
      <span className="text-sm font-semibold">{t(label)}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}

export function PanelSender({
  emoji,
  label,
  channelName,
  status,
  onSend,
  locked = false,
  error,
}: {
  emoji: string;
  label: string;
  channelName: string | null;
  status: "sending" | "sent" | "error" | undefined;
  onSend: () => void;
  locked?: boolean;
  error?: string | undefined;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border bg-card p-4">
      <h4 className="font-bold">
        {emoji} {t(label)}
      </h4>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {channelName
          ? t("Zostanie wysłany na #{channelName}", { channelName })
          : t("Najpierw ustaw kanał panelu powyżej i zapisz")}
      </p>
      <Button
        type="button"
        disabled={locked || !channelName || status === "sending"}
        onClick={onSend}
        className="mt-3 w-full"
      >
        {locked
          ? t("💎 Wymaga Premium")
          : status === "sending"
            ? t("Wysyłanie…")
            : status === "sent"
              ? t("✅ Zlecono – panel pojawi się za chwilę")
              : status === "error"
                ? t("❌ Błąd – spróbuj ponownie")
                : t("Wyślij panel")}
      </Button>
      {status === "error" && error && (
        <p className="mt-2 text-xs font-semibold text-destructive">{t(error)}</p>
      )}
    </div>
  );
}

export function Block({
  icon,
  title,
  hint,
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h3 className="font-display text-3xl">
        {icon} {title}
      </h3>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
