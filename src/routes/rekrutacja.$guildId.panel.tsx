import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useState } from "react";
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
  analyzeApplication,
  VERDICT_LABEL,
  verdictOf,
  type Verdict,
} from "@/lib/recruit-logic";
import type { AppRow } from "@/lib/recruit-types";
import { RkTools } from "@/components/rk-tools";
import { LanguageSwitch, useI18n } from "@/lib/i18n-react";
import { LOCALES, type Lang } from "@/lib/i18n";
import { headL } from "@/lib/i18n";

export const Route = createFileRoute("/rekrutacja/$guildId/panel")({
  head: ({ match }) => {
    const L = headL(match);
    return {
      meta: [
        { title: L("Panel ekipy — rekrutacja") },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  component: PanelRoot,
});

const shell = "rk min-h-screen bg-[var(--rk-bg)] text-[var(--rk-fg)]";
const card = "rounded-2xl border border-[var(--rk-line)] bg-[var(--rk-card)]";
const field =
  "w-full rounded-lg border border-[var(--rk-line)] bg-[var(--rk-field)] px-3 py-2 text-sm text-[var(--rk-fg)] outline-none focus:border-sky-400";
const btn = "rk-lift rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50";
const VERDICT_STYLE: Record<Verdict, { pill: string }> = {
  accept: { pill: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40" },
  maybe: { pill: "bg-amber-400/15 text-amber-300 border-amber-400/40" },
  reject: { pill: "bg-orange-500/15 text-orange-300 border-orange-500/40" },
  spam: { pill: "bg-red-500/15 text-red-300 border-red-500/40" },
};
const STATUS_STYLE: Record<AppStatus, string> = {
  pending: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  accepted: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
  rejected: "bg-red-400/15 text-red-300 border-red-400/40",
};
const whenIn = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleString(LOCALES[lang], { dateStyle: "short", timeStyle: "short" });

function PanelRoot() {
  return (
    <>
      <PanelPage />
      <RkTools />
    </>
  );
}

function PanelPage() {
  const { t } = useI18n();
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
          {q.isError ? t("Nie udało się wczytać panelu.") : t("Wczytywanie…")}
        </p>
      </main>
    );

  if (d.state === "login")
    return (
      <main className={`${shell} grid place-items-center px-5 text-center`}>
        <div>
          <p className="text-5xl">🔐</p>
          <h1 className="mt-3 text-2xl font-extrabold">{t("Panel ekipy rekrutacyjnej")}</h1>
          <p className="mt-2 text-[var(--rk-mut)]">
            {t("Zaloguj się kontem Discord, żeby zobaczyć podania.")}
          </p>
          <a
            href={`/api/public/auth/login?next=${encodeURIComponent(`/rekrutacja/${guildId}/panel`)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-block rounded-xl bg-[#5865F2] px-6 py-3 font-bold text-white hover:brightness-110"
          >
            {t("Zaloguj przez Discord")}
          </a>
          <p className="mt-3 text-xs text-[var(--rk-mut)]">
            {t("Po zalogowaniu odśwież tę stronę.")}
          </p>
        </div>
      </main>
    );

  if (d.state === "forbidden")
    return (
      <main className={`${shell} grid place-items-center px-5 text-center`}>
        <div className="max-w-md">
          <p className="text-5xl">⛔</p>
          <h1 className="mt-3 text-2xl font-extrabold">{t("Brak dostępu")}</h1>
          <p className="mt-2 text-[var(--rk-mut)]">
            {t("Jesteś zalogowany(-a) jako")} <b>{d.user.username}</b>
            {t(
              ", ale właściciel serwera nie nadał Ci dostępu do rekrutacji. Poproś go o dodanie Twojego ID Discord:",
            )}{" "}
            <code className="text-[var(--rk-fg2)]">{d.user.id}</code>.
          </p>
          <Link
            to="/rekrutacja/$guildId"
            params={{ guildId }}
            className="mt-6 inline-block font-semibold text-sky-300"
          >
            {t("← Wróć do strony rekrutacji")}
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
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"apps" | "staff">("apps");
  const [status, setStatus] = useState<AppStatus | "all">("pending");
  const [position, setPosition] = useState("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [shown, setShown] = useState(30); // lista podań ładuje się partiami – setki rozwijalnych kart naraz spowalniałyby panel
  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: ["rk-panel", guildId] }),
    [qc, guildId],
  );
  const toggle = useCallback((id: string) => setOpenId((cur) => (cur === id ? null : id)), []);
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
      <div className="rk-bar h-1.5 w-full" />
      <header className="animate-fade-up mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5">
        <div className="flex items-center gap-3">
          {icon && <img src={icon} alt="" className="size-10 rounded-xl" />}
          <div>
            <h1 className="text-xl font-extrabold leading-tight">
              {d.guild.name} {t("— rekrutacja")}
            </h1>
            <p className="text-xs text-[var(--rk-mut)]">
              {d.user.username} • {t(LEVEL_LABEL[d.level])}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <LanguageSwitch className="border-[var(--rk-line)]" />
          {d.siteEnabled && (
            <Link
              to="/rekrutacja/$guildId"
              params={{ guildId }}
              className="text-sky-300 hover:underline"
            >
              {t("Strona rekrutacji ↗")}
            </Link>
          )}
          <a
            href="/api/public/auth/logout"
            className="text-[var(--rk-mut)] hover:text-[var(--rk-fg)]"
          >
            {t("Wyloguj")}
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
            <div key={String(l)} className={`${card} card-lift rk-reveal p-4`}>
              <p className={`text-3xl font-extrabold ${c}`}>{n}</p>
              <p className="text-xs uppercase tracking-wider text-[var(--rk-mut)]">
                {t(String(l))}
              </p>
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
              {t(label)}
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
                  {s === "all" ? t("Wszystkie") : t(STATUS_LABEL[s])}
                </button>
              ))}
              <select
                className={`${field} !w-auto`}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="all">{t("Wszystkie stanowiska")}</option>
                {d.positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                className={`${field} !w-auto min-w-56 flex-1`}
                placeholder={t("Szukaj: nick, Roblox, ID…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="mt-4 space-y-3">
              {list.length === 0 && (
                <p className={`${card} p-8 text-center text-[var(--rk-mut)]`}>
                  {t("Brak podań w tym widoku.")}
                </p>
              )}
              {list.slice(0, shown).map((a) => (
                <AppCard
                  key={a.id}
                  a={a}
                  open={openId === a.id}
                  onToggle={toggle}
                  canReview={canReview}
                  canDelete={d.level === "manage"}
                  hasRole={!!d.positions.find((p) => p.id === a.positionId)?.roleId}
                  minChars={d.minChars}
                  onChanged={refresh}
                  guildId={guildId}
                />
              ))}
              {list.length > shown && (
                <button
                  type="button"
                  onClick={() => setShown((n) => n + 30)}
                  className={`${btn} w-full border border-[var(--rk-line)] hover:bg-[var(--rk-hover)]`}
                >
                  {t("Pokaż więcej (")}
                  {list.length - shown})
                </button>
              )}
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

const AppCard = memo(AppCardBase);
function AppCardBase({
  a,
  open,
  onToggle,
  canReview,
  canDelete,
  hasRole,
  minChars,
  onChanged,
  guildId,
}: {
  a: AppRow;
  open: boolean;
  onToggle: (id: string) => void;
  canReview: boolean;
  canDelete: boolean;
  hasRole: boolean;
  minChars: number;
  onChanged: () => void;
  guildId: string;
}) {
  const { t, lang } = useI18n();
  const when = (iso: string) => whenIn(iso, lang);
  const [note, setNote] = useState(a.note);
  const [notify, setNotify] = useState(!!a.discordId);
  const review = useMutation({
    mutationFn: (status: AppStatus) =>
      reviewApplication({ data: { guildId, id: a.id, status, note, notify } }),
    onSuccess: (r, status) => {
      toast.success(
        status === "accepted"
          ? t("Podanie przyjęte")
          : status === "rejected"
            ? t("Podanie odrzucone")
            : t("Przywrócono do oczekujących"),
      );
      for (const w of r.warnings) toast.warning(w);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? t(e.message) : t("Nie udało się zapisać")),
  });
  const del = useMutation({
    mutationFn: () => deleteApplication({ data: { guildId, id: a.id } }),
    onSuccess: () => {
      toast.success(t("Usunięto podanie"));
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? t(e.message) : t("Nie udało się usunąć")),
  });
  // ocena liczona na bieżąco tym samym kodem co przy wysyłce – stare podania też dostają mądrą ocenę
  const ai = useMemo(
    () =>
      analyzeApplication(
        a.answers.map((x) => ({ q: x.q, a: x.a, style: x.s })),
        minChars,
        { tabSwitches: a.tabSwitches, age: a.age },
      ),
    [a, minChars],
  );
  const tone = VERDICT_STYLE[ai.verdict];

  return (
    <article className={`${card} rk-reveal overflow-hidden`}>
      <button
        type="button"
        onClick={() => onToggle(a.id)}
        className="flex w-full flex-wrap items-center gap-3 p-4 text-left hover:bg-[var(--rk-card)]"
      >
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[a.status]}`}
        >
          {t(STATUS_LABEL[a.status])}
        </span>
        <span className="font-bold">{a.discordNick}</span>
        <span className="text-sm text-[var(--rk-mut)]">
          {t("Roblox:")} {a.robloxNick} • {a.age} {t("l. •")} {a.positionLabel}
        </span>
        <span className="ml-auto flex items-center gap-3 text-xs text-[var(--rk-mut)]">
          <span
            className={`rounded-full border px-2.5 py-0.5 font-bold ${tone.pill}`}
            title={t("Wstępna ocena automatyczna (tylko podpowiedź)")}
          >
            {ai.score}/100 · {t(VERDICT_LABEL[ai.verdict])}
          </span>
          {when(a.createdAt)}
          <span>{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-[var(--rk-line)] p-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--rk-fg2)]">
            <span>
              {t("Discord:")} <b>{a.discordNick}</b>
            </span>
            <span>
              {t("ID:")} <b>{a.discordId ?? t("nie podano")}</b>
            </span>
            <span>
              {t("Roblox:")} <b>{a.robloxNick}</b>
            </span>
            <span>
              {t("Wiek:")} <b>{a.age}</b>
            </span>
            <span>
              {t("Przełączenia kart:")}{" "}
              <b className={a.tabSwitches > 5 ? "text-amber-300" : ""}>{a.tabSwitches}</b>
            </span>
          </div>
          <div className={`rounded-xl border p-4 ${tone.pill}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-3xl font-extrabold">{ai.score}</span>
              <span className="text-xs font-bold opacity-70">{t("/ 100 pkt")}</span>
              <span className="text-sm font-extrabold uppercase tracking-wide">
                {t(VERDICT_LABEL[ai.verdict])}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--rk-hover)]"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-current transition-all duration-500"
                style={{ width: `${ai.score}%` }}
              />
            </div>
            {ai.flags.length > 0 && (
              <ul className="mt-3 space-y-0.5 text-xs">
                {ai.flags.map((f) =>
                  f.startsWith("+") ? (
                    <li key={f} className="text-emerald-400">
                      ✅ {t(f.slice(1))}
                    </li>
                  ) : (
                    <li key={f} className="text-amber-300">
                      ⚠️ {t(f)}
                    </li>
                  ),
                )}
              </ul>
            )}
            <p className="mt-3 text-[11px] opacity-70">
              {t(
                "To tylko podpowiedź automatu (sprawdza sens, spam i powtórzenia) – decyzję zawsze podejmuje człowiek.",
              )}
            </p>
          </div>
          <div className="space-y-3">
            {a.answers.map((x, i) => {
              const r = ai.perAnswer[i];
              const rt = r ? VERDICT_STYLE[verdictOf(r.score)] : null;
              return (
                <div key={x.id} className="rounded-xl bg-[var(--rk-field)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--rk-mut)]">
                      {i + 1}. {x.q}
                    </p>
                    {r && rt && (
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${rt.pill}`}
                        title={r.notes.map((n) => t(n.replace(/^\+/, ""))).join(" • ")}
                      >
                        {r.score}/100
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--rk-fg)]">{x.a}</p>
                  {r && r.notes.length > 0 && (
                    <p className="mt-2 text-[11px] text-[var(--rk-mut)]">
                      {r.notes
                        .map((n) => (n.startsWith("+") ? `✅ ${t(n.slice(1))}` : `⚠️ ${t(n)}`))
                        .join("  ")}
                    </p>
                  )}
                </div>
              );
            })}
            {a.answers.length === 0 && (
              <p className="text-sm text-[var(--rk-mut)]">{t("Brak odpowiedzi.")}</p>
            )}
          </div>

          {a.reviewedBy && a.reviewedAt && (
            <p className="text-xs text-[var(--rk-mut)]">
              {t("Ostatnia decyzja:")} {a.reviewedBy}, {when(a.reviewedAt)}
            </p>
          )}

          {canReview ? (
            <div className="space-y-3 border-t border-[var(--rk-line)] pt-4">
              <textarea
                className={`${field} min-h-20`}
                maxLength={1000}
                placeholder={t("Uwagi do decyzji (widoczne w logu i w wiadomości do kandydata)")}
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
                    {t("Wyślij kandydatowi wiadomość prywatna")}
                    {hasRole ? t(" i nadaj rangę stanowiska (przy przyjęciu)") : ""}
                    {t(". ID podał kandydat – upewnij się, że to jego konto.")}
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
                  {t("✅ Przyjmij")}
                </button>
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() => review.mutate("rejected")}
                  className={`${btn} bg-red-500 text-white hover:brightness-110`}
                >
                  {t("❌ Odrzuć")}
                </button>
                {a.status !== "pending" && (
                  <button
                    type="button"
                    disabled={review.isPending}
                    onClick={() => review.mutate("pending")}
                    className={`${btn} border border-[var(--rk-line)] hover:bg-[var(--rk-hover)]`}
                  >
                    {t("↩ Przywróć do oczekujących")}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    disabled={del.isPending}
                    onClick={() =>
                      confirm(
                        t("Usunąć podanie {discordNick} na zawsze?", {
                          discordNick: a.discordNick,
                        }),
                      ) && del.mutate()
                    }
                    className={`${btn} ml-auto border border-red-500/40 text-red-300 hover:bg-red-500/10`}
                  >
                    {t("🗑 Usuń")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="border-t border-[var(--rk-line)] pt-3 text-xs text-[var(--rk-mut)]">
              {t("Masz dostęp tylko do podglądu — decyzje podejmują rekruterzy.")}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function Staff({ d, guildId, onChanged }: { d: Ok; guildId: string; onChanged: () => void }) {
  const { t } = useI18n();
  const [userId, setUserId] = useState("");
  const [level, setLevel] = useState<StaffLevel>("review");
  const save = useMutation({
    mutationFn: (v: { userId: string; level: StaffLevel | null }) =>
      setRecruitStaff({ data: { guildId, ...v } }),
    onSuccess: (_r, v) => {
      toast.success(v.level ? t("Zapisano uprawnienia") : t("Odebrano dostęp"));
      setUserId("");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? t(e.message) : t("Nie udało się zapisać")),
  });
  return (
    <div className="mt-5 space-y-5">
      <div className={`${card} p-5`}>
        <h2 className="text-lg font-extrabold">{t("Dodaj osobę do ekipy rekrutacyjnej")}</h2>
        <p className="mt-1 text-sm text-[var(--rk-mut)]">
          {t(
            "Zarządcy serwera (uprawnienie „Zarządzanie serwerem” na Discordzie) mają dostęp automatycznie. Pozostałym możesz nadać dostęp, wpisując ich ID Discord (Ustawienia → Zaawansowane → Tryb dewelopera → prawy klik na profilu → Kopiuj ID).",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className={`${field} !w-auto min-w-64 flex-1`}
            inputMode="numeric"
            maxLength={20}
            placeholder={t("ID użytkownika Discord")}
            value={userId}
            onChange={(e) => setUserId(e.target.value.replace(/\D/g, ""))}
          />
          <select
            className={`${field} !w-auto`}
            value={level}
            onChange={(e) => setLevel(e.target.value as StaffLevel)}
          >
            <option value="review">{t("Rekruter (podgląd i decyzje)")}</option>
            <option value="view">{t("Podgląd (tylko czytanie)")}</option>
          </select>
          <button
            type="button"
            disabled={save.isPending || userId.length < 17}
            onClick={() => save.mutate({ userId, level })}
            className={`${btn} bg-sky-500 text-black hover:brightness-110`}
          >
            {t("Dodaj")}
          </button>
        </div>
      </div>

      <div className={`${card} divide-y divide-[var(--rk-line)]`}>
        {d.staff.length === 0 && (
          <p className="p-6 text-center text-[var(--rk-mut)]">
            {t("Nikt jeszcze nie ma nadanego dostępu.")}
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
              <option value="review">{t("Rekruter")}</option>
              <option value="view">{t("Podgląd")}</option>
            </select>
            <button
              type="button"
              onClick={() =>
                confirm(t("Odebrać dostęp: {v1}?", { v1: s.username || s.userId })) &&
                save.mutate({ userId: s.userId, level: null })
              }
              className={`${btn} border border-red-500/40 text-red-300 hover:bg-red-500/10`}
            >
              {t("Odbierz")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
