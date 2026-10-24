import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  adminAudit,
  adminBackup,
  adminDeleteStale,
  adminRestore,
  adminRevokeSession,
  adminSessions,
  adminStale,
} from "@/lib/admin.functions";
import { fmtDateTime, relTime } from "@/lib/format";
import {
  Card,
  ConfirmButton,
  Empty,
  ErrorBox,
  Loading,
  Pill,
  download,
  useAdminAction,
} from "./common";
import { KEY_OVERVIEW } from "./overview";
import { KEY_SERVERS } from "./servers";

const KEY_SESSIONS = ["admin", "sessions"] as const;
const KEY_STALE = ["admin", "stale"] as const;

/** Zalogowani użytkownicy panelu: podgląd i unieważnianie sesji (tokeny nigdy nie opuszczają serwera). */
export function SessionsTab() {
  const q = useQuery({ queryKey: KEY_SESSIONS, queryFn: () => adminSessions() });
  const inv = { invalidate: [[...KEY_SESSIONS], [...KEY_OVERVIEW]] };
  const revoke = useAdminAction((id: string) => adminRevokeSession({ data: { id } }), {
    ...inv,
    ok: "Sesja unieważniona",
  });
  const revokeAll = useAdminAction(() => adminRevokeSession({ data: { allExceptMine: true } }), {
    ...inv,
    ok: "Wylogowano wszystkich oprócz Ciebie",
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const list = q.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {list.length} aktywnych sesji (ważne do 7 dni od logowania).
        </p>
        <ConfirmButton
          label="Wyloguj wszystkich (oprócz mnie)"
          confirmLabel="Wylogować wszystkich?"
          disabled={list.length <= 1}
          onConfirm={() => revokeAll.mutate()}
        />
      </div>
      {list.length === 0 ? (
        <Empty>Brak sesji.</Empty>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {list.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-semibold">{s.username}</span>
              <span className="font-mono text-xs text-muted-foreground">{s.userId}</span>
              <span className="text-xs text-muted-foreground">
                zalogowany {fmtDateTime(s.createdAt)} • wygasa {relTime(s.expiresAt)}
              </span>
              {s.mine ? (
                <Pill tone="good">to Ty</Pill>
              ) : (
                <span className="ml-auto">
                  <ConfirmButton
                    size="sm"
                    variant="ghost"
                    label="Unieważnij"
                    confirmLabel="Unieważnić?"
                    onConfirm={() => revoke.mutate(s.id)}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Narzędzia: nieaktualne konfiguracje, kopia zapasowa i przywracanie. */
export function ToolsTab() {
  const stale = useQuery({ queryKey: KEY_STALE, queryFn: () => adminStale() });
  const [json, setJson] = useState("");
  const inv = { invalidate: [[...KEY_STALE], [...KEY_SERVERS], [...KEY_OVERVIEW]] };
  const backup = useAdminAction(() => adminBackup(), {
    ok: (b) => `Kopia: ${b.rows.length} serwerów`,
  });
  const restore = useAdminAction(() => adminRestore({ data: { json, confirm: true } }), {
    ...inv,
    ok: (r) =>
      `Przywrócono ${r.restored} serwerów${r.errors.length ? `, błędów: ${r.errors.length}` : ""}`,
  });
  const del = useAdminAction(
    (ids: string[]) => adminDeleteStale({ data: { ids, confirm: true } }),
    { ...inv, ok: (r) => `Usunięto ${r.deleted} konfiguracji` },
  );
  const list = stale.data ?? [];
  return (
    <div className="space-y-5">
      <Card
        title="🧹 Nieaktualne konfiguracje"
        hint="Serwery, które mają zapisaną konfigurację, ale bota już na nich nie ma. Konfiguracje aktywnych klientów Premium nigdy nie są kasowane."
      >
        {stale.isLoading ? (
          <Loading />
        ) : stale.error ? (
          <ErrorBox error={stale.error} />
        ) : list.length === 0 ? (
          <Empty>Wszystko aktualne – brak serwerów bez bota.</Empty>
        ) : (
          <>
            <ul className="mb-3 divide-y text-sm">
              {list.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="font-mono text-xs">{s.id}</span>
                  {s.premium.active && <Pill tone="gold">Premium – nie zostanie usunięta</Pill>}
                  <span className="text-xs text-muted-foreground">
                    zmiana {relTime(s.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
            <ConfirmButton
              label={`Usuń ${list.length} nieaktualnych`}
              confirmLabel="Usunąć na stałe?"
              onConfirm={() => del.mutate(list.map((s) => s.id))}
            />
          </>
        )}
      </Card>

      <Card
        title="💾 Kopia zapasowa wszystkich konfiguracji"
        hint="Plik JSON ze wszystkimi serwerami: kanały, rangi, ustawienia, treści i dane Premium. Trzymaj go w bezpiecznym miejscu."
      >
        <Button
          type="button"
          variant="outline"
          disabled={backup.isPending}
          onClick={() =>
            backup.mutate(undefined, {
              onSuccess: (b) =>
                download(
                  `kopia-ehbot-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(b, null, 2),
                ),
            })
          }
        >
          ⬇️ Pobierz kopię
        </Button>
      </Card>

      <Card
        title="♻️ Przywracanie z kopii"
        hint="Wklej zawartość pliku z kopii. Serwery z pliku zostaną nadpisane; pozostałe nie są ruszane."
      >
        <Textarea
          rows={6}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          className="font-mono text-xs"
          placeholder='{"version":1,"rows":[…]}'
        />
        <div className="mt-3">
          <ConfirmButton
            label="Przywróć kopię"
            confirmLabel="Nadpisać konfiguracje?"
            disabled={!json.trim() || restore.isPending}
            onConfirm={() => restore.mutate()}
          />
        </div>
      </Card>
    </div>
  );
}

/** Pełny dziennik audytu (ostatnie 500 operacji administratora i kliknięć „Kup”). */
export function AuditTab({ onOpenServer }: { onOpenServer: (id: string) => void }) {
  const q = useQuery({
    queryKey: ["admin", "audit", "all"],
    queryFn: () => adminAudit({ data: { limit: 500 } }),
  });
  const [filter, setFilter] = useState("");
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const f = filter.trim().toLowerCase();
  const rows = (q.data ?? []).filter(
    (a) => !f || `${a.action} ${a.details} ${a.guild ?? ""} ${a.by}`.toLowerCase().includes(f),
  );
  return (
    <div className="space-y-3">
      <input
        className="editor-select"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtruj: akcja, serwer, osoba…  (np. kliknięcie-kup, płatność)"
        aria-label="Filtr dziennika"
      />
      <p className="text-xs text-muted-foreground">
        {rows.length} wpisów (maks. 500 ostatnich). „kliknięcie-kup” to osoby zainteresowane zakupem
        – warto do nich napisać.
      </p>
      {rows.length === 0 ? (
        <Empty>Brak wpisów.</Empty>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
              <span className="w-36 shrink-0 text-xs text-muted-foreground">
                {fmtDateTime(a.at)}
              </span>
              <Pill tone={a.action === "kliknięcie-kup" ? "gold" : "muted"}>{a.action}</Pill>
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
    </div>
  );
}
