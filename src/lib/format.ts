// Drobne formatery do interfejsu (daty po polsku).
export const fmtDate = (iso: string | Date | null | undefined): string => {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
};
export const fmtDateTime = (iso: string | Date | null | undefined): string => {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};
export const fmtMoney = (n: number): string =>
  `${n.toLocaleString("pl-PL", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} zł`;
/** „za 3 dni” / „2 godz. temu” – zwięzły czas względny. */
export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const diff = Date.parse(iso) - now,
    abs = Math.abs(diff);
  const unit =
    abs < 3_600_000
      ? ([Math.max(1, Math.round(abs / 60_000)), "min"] as const)
      : abs < 86_400_000
        ? ([Math.round(abs / 3_600_000), "godz."] as const)
        : ([Math.round(abs / 86_400_000), "dni"] as const);
  return diff >= 0 ? `za ${unit[0]} ${unit[1]}` : `${unit[0]} ${unit[1]} temu`;
}
