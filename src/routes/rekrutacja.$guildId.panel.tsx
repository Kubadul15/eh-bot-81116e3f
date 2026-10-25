import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  deleteApplication,
  getRecruitPanel,
  reviewApplication,
  setRecruitStaff,
} from "@/lib/recruit-site.functions";
import {
  LEVEL_LABEL,
  STATUS_LABEL,
  STATUSES,
  type AppStatus,
  type StaffLevel,
} from "@/lib/recruit-logic";
import type { AppRow } from "@/lib/recruit-types";
import { RkTools } from "@/components/rk-tools";

export const Route = createFileRoute("/rekrutacja/$guildId/panel")({
  head: () => ({
    meta: [{ title: "Panel ekipy — rekrutacja" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: PanelRoot,
});

const shell = "rk min-h-screen bg-[var(--rk-bg)] text-[var(--rk-fg)]";
const card = "rounded-2xl border border-[var(--rk-line)] bg-[var(--rk-card)]";
const field =
  "w-full rounded-lg border border-[var(--rk-line)] bg-[var(--rk-field)] px-3 py-2 text-sm text-[var(--rk-fg)] outline-none focus:border-sky-400";
const btn = "rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-50";
const STATUS_STYLE: Record<AppStatus, string> = {
  pending: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  accepted: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
  rejected: "bg-red-400/15 text-red-300 border-red-400/40",
};
const when = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });

function PanelRoot() {
  return (
    <>
      <PanelPage />
      <RkTools />
    </>
  );
}

function PanelPage() {
  const { guildId } = Route.useParams();
  const q = useQuery({
    queryKey: ["rk-panel", guildId],
    queryFn: () => getRecruitPanel({ data: { guildId } }),
    refetchInterval: 30_000,
  });
  const d = q.data;

  if (q.isLoading || !d)
    return (
      <main className={`${shell} grid place-items-center`}>
        <p className="text-[var(--rk-mut)]">
          {q.isError ? "Nie udało się wczytać panelu." : "Wczytywanie…"}
        </p>
      </main>
    );

  if (d.state === "login")
    return (
      <main className={`${shell} grid place-items-center px-5 text-center`}>
        <div>
          <p className="text-5xl">🔐</p>
          <h1 className="mt-3 text-2xl font-extrabold">Panel ekipy rekrutacyjnej</h1>
          <p className="mt-2 text-[var(--rk-mut)]">
            Zaloguj się kontem Discord, żeby zobaczyć podania.
          </p>
          <a
            href={`/api/public/auth/login?next=${encodeURIComponent(`/rekrutacja/${guildId}/panel`)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-block rounded-xl bg-[#5865F2] px-6 py-3 font-bold text-white hover:brightness-110"
          >
            Zaloguj przez Discord
          </a>
          <p className="mt-3 text-xs text-[var(--rk-mut)]">Po zalogowaniu odśwież tę stronę.</p>
        </div>
      </main>
    );

  if (d.state === "forbidden")
    return (
      <main className={`${shell} grid place-items-center px-5 text-center`}>
        <div className="max-w-md">
          <p className="text-5xl">⛔</p>
          <h1 className="mt-3 text-2xl font-extrabold">Brak dostępu</h1>
          <p className="mt-2 text-[var(--rk-mut)]">
            Jesteś zalogowany(-a) jako <b>{d.user.username}</b>, ale właściciel serwera nie nadał Ci
            dostępu do rekrutacji. Poproś go o dodanie Twojego ID Discord:{" "}
            <code className="text-[var(--rk-fg2)]">{d.user.id}</code>.
          </p>
          <Link
            to="/rekrutacja/$guildId"
            params={{ guildId }}
            className="mt-6 inline-block font-semibold text-sky-300"
          >
            ← Wróć do strony rekrutacji
          </Link>
        </div>
      </main>
    );

  if (d.state === "unavailable")
    return (
      <main className={`${shell} grid place-items-center px-5 text-center`}>
        <div className="max-w-md">
          <p className="text-5xl">🔒</p>
          <h1 className="mt-3 text-2xl font-extrabold">{d.guildName}</h1>
          <p className="mt-2 text-[var(--rk-mut)]">{d.reason}</p>
        </div>
      </main>
    );

  return <Dashboard d={d} guildId={guildId} />;
}

type Ok = Extract<Awaited<ReturnType<typeof getRecruitPanel>>, { state: "ok" }>;

function Dashboard({ d, guildId }: { d: Ok; guildId: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"apps" | "staff">("apps");
  const [status, setStatus] = useState<AppStatus | "all">("pending");
  const [position, setPosition] = useState("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["rk-panel", guildId] });
  const canReview = d.level === "review" || d.level === "manage";

  const counts = useMemo(() => {
    const c = { pending: 0, accepted: 0, rejected: 0 };
    for (const a of d.apps) c[a.status]++;
    return c;
  }, [d.apps]);
  const list = useMemo(() => {
    const n = search.trim().toLowerCase();
    return d.apps.filter(
      (a) =>
        (status === "all" || a.status === status) &&
        (position === "all" || a.positionId === position) &&
        (!n || `${a.discordNick} ${a.robloxNick} ${a.discordId ?? ""}`.toLowerCase().includes(n)),
    );
  }, [d.apps, status, position, search]);
  const icon = d.guild.icon
    ? `https://cdn.discordapp.com/icons/${d.guild.id}/${d.guild.icon}.png?size=64`
    : "";

  return (
    <main className={`${shell} pb-16`}>
      <Toaster richColors position="top-right" />
      <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-sky-400" />
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5">
        <div className="flex items-center gap-3">
          {icon && <img src={icon} alt="" className="size-10 rounded-xl" />}
          <div>
            <h1 className="text-xl font-extrabold leading-tight">{d.guild.name} — rekrutacja</h1>
            <p className="text-xs text-[var(--rk-mut)]">
              {d.user.username} • {LEVEL_LABEL[d.level]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-semibold">
          {d.siteEnabled && (
            <Link
              to="/rekrutacja/$guildId"
              params={{ guildId }}
              className="text-sky-300 hover:underline"
            >
              Strona rekrutacji ↗
            </Link>
          )}
          <a
            href="/api/public/auth/logout"
            className="text-[var(--rk-mut)] hover:text-[var(--rk-fg)]"
          >
            Wyloguj
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Wszystkie", d.apps.length, "text-[var(--rk-fg)]"],
            ["Oczekują", counts.pending, "text-amber-300"],
            ["Przyjęte", counts.accepted, "text-emerald-300"],
            ["Odrzucone", counts.rejected, "text-red-300"],
          ].map(([l, n, c]) => (
            <div key={String(l)} className={`${card} p-4`}>
              <p className={`text-3xl font-extrabold ${c}`}>{n}</p>
              <p className="text-xs uppercase tracking-wider text-[var(--rk-mut)]">{l}</p>
            </div>
          ))}
        </div>

        <nav className="mt-6 flex gap-2 border-b border-[var(--rk-line)] pb-3">
          {(
            [
              ["apps", "📋 Podania"],
              ...(d.level === "manage" ? [["staff", "👥 Uprawnienia ekipy"]] : []),
            ] as ["apps" | "staff", string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${tab === id ? "border-sky-400 bg-sky-400/15 text-sky-200" : "border-[var(--rk-line)] hover:bg-[var(--rk-hover)]"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "apps" && (
          <div className="mt-5">
            <div className="flex flex-wrap gap-2">
              {(["all", ...STATUSES] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${status === s ? "border-sky-400 bg-sky-400/15 text-sky-200" : "border-[var(--rk-line)] text-[var(--rk-fg2)] hover:bg-[var(--rk-hover)]"}`}
                >
                  {s === "all" ? "Wszystkie" : STATUS_LABEL[s]}
                </button>
              ))}
              <select
                className={`${field} !w-auto`}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="all">Wszystkie stanowiska</option>
                {d.positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                className={`${field} !w-auto min-w-56 flex-1`}
                placeholder="Szukaj: nick, Roblox, ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="mt-4 space-y-3">
              {list.length === 0 && (
                <p className={`${card} p-8 text-center text-[var(--rk-mut)]`}>
                  Brak podań w tym widoku.
                </p>
              )}
              {list.map((a) => (
                <AppCard
                  key={a.id}
                  a={a}
                  open={openId === a.id}
                  onToggle={() => setOpenId(openId === a.id ? null : a.id)}
                  canReview={canReview}
                  canDelete={d.level === "manage"}
                  hasRole={!!d.positions.find((p) => p.id === a.positionId)?.roleId}
                  onChanged={refresh}
                  guildId={guildId}
                />
              ))}
            </div>
          </div>
        )}

        {tab === "staff" && d.level === "manage" && (
          <Staff d={d} guildId={guildId} onChanged={refresh} />
        )}
      </section>
    </main>
  );
}

function AppCard({
  a,
  open,
  onToggle,
  canReview,
  canDelete,
  hasRole,
  onChanged,
  guildId,
}: {
  a: AppRow;
  open: boolean;
  onToggle: () => void;
  canReview: boolean;
  canDelete: boolean;
  hasRole: boolean;
  onChanged: () => void;
  guildId: string;
}) {
  const [note, setNote] = useState(a.note);
  const [notify, setNotify] = useState(!!a.discordId);
  const review = useMutation({
    mutationFn: (status: AppStatus) =>
      reviewApplication({ data: { guildId, id: a.id, status, note, notify } }),
    onSuccess: (r, status) => {
      toast.success(
        status === "accepted"
          ? "Podanie przyjęte"
          : status === "rejected"
            ? "Podanie odrzucone"
            : "Przywrócono do oczekujących",
      );
      for (const w of r.warnings) toast.warning(w);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nie udało się zapisać"),
  });
  const del = useMutation({
    mutationFn: () => deleteApplication({ data: { guildId, id: a.id } }),
    onSuccess: () => {
      toast.success("Usunięto podanie");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nie udało się usunąć"),
  });
  const scoreTone =
    a.autoScore >= 70 ? "text-emerald-300" : a.autoScore >= 40 ? "text-amber-300" : "text-red-300";

  return (
    <article className={`${card} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-3 p-4 text-left hover:bg-[var(--rk-card)]"
      >
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[a.status]}`}
        >
          {STATUS_LABEL[a.status]}
        </span>
        <span className="font-bold">{a.discordNick}</span>
        <span className="text-sm text-[var(--rk-mut)]">
          Roblox: {a.robloxNick} • {a.age} l. • {a.positionLabel}
        </span>
        <span className="ml-auto flex items-center gap-3 text-xs text-[var(--rk-mut)]">
          <span
            className={`font-bold ${scoreTone}`}
            title="Wstępna ocena automatyczna (tylko podpowiedź)"
          >
            {a.autoScore}/100
          </span>
          {when(a.createdAt)}
          <span>{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-[var(--rk-line)] p-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--rk-fg2)]">
            <span>
              Discord: <b>{a.discordNick}</b>
            </span>
            <span>
              ID: <b>{a.discordId ?? "nie podano"}</b>
            </span>
            <span>
              Roblox: <b>{a.robloxNick}</b>
            </span>
            <span>
              Wiek: <b>{a.age}</b>
            </span>
            <span>
              Przełączenia kart:{" "}
              <b className={a.tabSwitches > 5 ? "text-amber-300" : ""}>{a.tabSwitches}</b>
            </span>
          </div>
          {a.flags.length > 0 && (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
              ⚠️ Uwagi automatu: {a.flags.join(", ")}. To tylko podpowiedź — oceń odpowiedzi
              samodzielnie.
            </p>
          )}
          <div className="space-y-3">
            {a.answers.map((x, i) => (
              <div key={x.id} className="rounded-xl bg-[var(--rk-field)] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--rk-mut)]">
                  {i + 1}. {x.q}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--rk-fg)]">{x.a}</p>
              </div>
            ))}
            {a.answers.length === 0 && (
              <p className="text-sm text-[var(--rk-mut)]">Brak odpowiedzi.</p>
            )}
          </div>

          {a.reviewedBy && a.reviewedAt && (
            <p className="text-xs text-[var(--rk-mut)]">
              Ostatnia decyzja: {a.reviewedBy}, {when(a.reviewedAt)}
            </p>
          )}

          {canReview ? (
            <div className="space-y-3 border-t border-[var(--rk-line)] pt-4">
              <textarea
                className={`${field} min-h-20`}
                maxLength={1000}
                placeholder="Uwagi do decyzji (widoczne w logu i w wiadomości do kandydata)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {a.discordId && (
                <label className="flex items-start gap-2 text-sm text-[var(--rk-fg2)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4"
                    checked={notify}
                    onChange={(e) => setNotify(e.target.checked)}
                  />
                  <span>
                    Wyślij kandydatowi wiadomość prywatna
                    {hasRole ? " i nadaj rangę stanowiska (przy przyjęciu)" : ""}. ID podał kandydat
                    – upewnij się, że to jego konto.
                  </span>
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() => review.mutate("accepted")}
                  className={`${btn} bg-emerald-500 text-black hover:brightness-110`}
                >
                  ✅ Przyjmij
                </button>
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() => review.mutate("rejected")}
                  className={`${btn} bg-red-500 text-white hover:brightness-110`}
                >
                  ❌ Odrzuć
                </button>
                {a.status !== "pending" && (
                  <button
                    type="button"
                    disabled={review.isPending}
                    onClick={() => review.mutate("pending")}
                    className={`${btn} border border-[var(--rk-line)] hover:bg-[var(--rk-hover)]`}
                  >
                    ↩ Przywróć do oczekujących
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    disabled={del.isPending}
                    onClick={() =>
                      confirm(`Usunąć podanie ${a.discordNick} na zawsze?`) && del.mutate()
                    }
                    className={`${btn} ml-auto border border-red-500/40 text-red-300 hover:bg-red-500/10`}
                  >
                    🗑 Usuń
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="border-t border-[var(--rk-line)] pt-3 text-xs text-[var(--rk-mut)]">
              Masz dostęp tylko do podglądu — decyzje podejmują rekruterzy.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function Staff({ d, guildId, onChanged }: { d: Ok; guildId: string; onChanged: () => void }) {
  const [userId, setUserId] = useState("");
  const [level, setLevel] = useState<StaffLevel>("review");
  const save = useMutation({
    mutationFn: (v: { userId: string; level: StaffLevel | null }) =>
      setRecruitStaff({ data: { guildId, ...v } }),
    onSuccess: (_r, v) => {
      toast.success(v.level ? "Zapisano uprawnienia" : "Odebrano dostęp");
      setUserId("");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nie udało się zapisać"),
  });
  return (
    <div className="mt-5 space-y-5">
      <div className={`${card} p-5`}>
        <h2 className="text-lg font-extrabold">Dodaj osobę do ekipy rekrutacyjnej</h2>
        <p className="mt-1 text-sm text-[var(--rk-mut)]">
          Zarządcy serwera (uprawnienie „Zarządzanie serwerem” na Discordzie) mają dostęp
          automatycznie. Pozostałym możesz nadać dostęp, wpisując ich ID Discord (Ustawienia →
          Zaawansowane → Tryb dewelopera → prawy klik na profilu → Kopiuj ID).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className={`${field} !w-auto min-w-64 flex-1`}
            inputMode="numeric"
            maxLength={20}
            placeholder="ID użytkownika Discord"
            value={userId}
            onChange={(e) => setUserId(e.target.value.replace(/\D/g, ""))}
          />
          <select
            className={`${field} !w-auto`}
            value={level}
            onChange={(e) => setLevel(e.target.value as StaffLevel)}
          >
            <option value="review">Rekruter (podgląd i decyzje)</option>
            <option value="view">Podgląd (tylko czytanie)</option>
          </select>
          <button
            type="button"
            disabled={save.isPending || userId.length < 17}
            onClick={() => save.mutate({ userId, level })}
            className={`${btn} bg-sky-500 text-black hover:brightness-110`}
          >
            Dodaj
          </button>
        </div>
      </div>

      <div className={`${card} divide-y divide-[var(--rk-line)]`}>
        {d.staff.length === 0 && (
          <p className="p-6 text-center text-[var(--rk-mut)]">
            Nikt jeszcze nie ma nadanego dostępu.
          </p>
        )}
        {d.staff.map((s) => (
          <div key={s.userId} className="flex flex-wrap items-center gap-3 p-4">
            <div>
              <p className="font-bold">{s.username || s.userId}</p>
              <p className="text-xs text-[var(--rk-mut)]">{s.userId}</p>
            </div>
            <select
              className={`${field} ml-auto !w-auto`}
              value={s.level}
              onChange={(e) =>
                save.mutate({ userId: s.userId, level: e.target.value as StaffLevel })
              }
            >
              <option value="review">Rekruter</option>
              <option value="view">Podgląd</option>
            </select>
            <button
              type="button"
              onClick={() =>
                confirm(`Odebrać dostęp: ${s.username || s.userId}?`) &&
                save.mutate({ userId: s.userId, level: null })
              }
              className={`${btn} border border-red-500/40 text-red-300 hover:bg-red-500/10`}
            >
              Odbierz
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
