import { useState } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Mutacja serwerowa z komunikatami (toast) i odświeżeniem wskazanych zapytań. */
export function useAdminAction<A, R>(
  fn: (a: A) => Promise<R>,
  opts: { ok?: string | ((r: R) => string); invalidate?: QueryKey[] } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      const msg = typeof opts.ok === "function" ? opts.ok(r) : opts.ok;
      if (msg) toast.success(msg);
      for (const key of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nie udało się wykonać operacji"),
  });
}

export function download(filename: string, text: string, mime = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Przycisk z dwustopniowym potwierdzeniem (pierwsze kliknięcie pyta „Na pewno?”) – dla operacji nieodwracalnych. */
export function ConfirmButton({
  label,
  confirmLabel = "Na pewno? Kliknij ponownie",
  onConfirm,
  disabled,
  ...rest
}: Omit<ButtonProps, "onClick"> & {
  label: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      type="button"
      {...rest}
      disabled={disabled}
      variant={armed ? "destructive" : (rest.variant ?? "outline")}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          setTimeout(() => setArmed(false), 4000);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}

export function Card({
  title,
  hint,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border bg-card p-5 ${className}`}>
      {title && <h3 className="font-bold">{title}</h3>}
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className={title || hint ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string | undefined;
  tone?: "good" | "warn" | "bad" | undefined;
}) {
  const color =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "bad"
          ? "text-destructive"
          : "";
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-display text-4xl tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    {children}
  </span>
);

export function Pill({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "good" | "gold" | "bad" | "info";
}) {
  const c = {
    muted: "bg-muted text-muted-foreground",
    good: "bg-emerald-600 text-white",
    gold: "bg-gradient-to-r from-amber-400 to-orange-500 text-black",
    bad: "bg-destructive text-white",
    info: "bg-sky-600 text-white",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${c}`}
    >
      {children}
    </span>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
    {children}
  </p>
);
export const Loading = () => (
  <p className="p-6 text-center text-sm text-muted-foreground">Wczytywanie…</p>
);
export const ErrorBox = ({ error }: { error: unknown }) => (
  <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
    ❌ {error instanceof Error ? error.message : "Błąd"}
  </p>
);
