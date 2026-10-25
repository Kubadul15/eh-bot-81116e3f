import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPublicRecruit, submitApplication } from "@/lib/recruit-site.functions";
import { MAX_ANSWER, NICK } from "@/lib/recruit-logic";
import type { PublicQuestion, PublicRecruit } from "@/lib/recruit-types";
import { RkTools } from "@/components/rk-tools";

export const Route = createFileRoute("/rekrutacja/$guildId/")({
  loader: ({ params }) => getPublicRecruit({ data: { guildId: params.guildId } }),
  head: ({ loaderData }) => {
    const ok = loaderData?.state === "ok" ? loaderData : null;
    const title = ok ? `Rekrutacja — ${ok.guild.name}` : "Rekrutacja";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: ok ? ok.site.intro.slice(0, 160) : "Strona rekrutacyjna serwera.",
        },
        { property: "og:title", content: title },
        ...(ok?.site.banner ? [{ property: "og:image", content: ok.site.banner }] : []),
      ],
    };
  },
  component: RecruitPage,
});

type Ok = Extract<PublicRecruit, { state: "ok" }>;
type Question = PublicQuestion;

const draftKey = (guildId: string) => `rk-draft-${guildId}`;
type Draft = {
  positionId: string;
  discordNick: string;
  discordId: string;
  robloxNick: string;
  age: string;
  answers: Record<string, string>;
};
const emptyDraft = (): Draft => ({
  positionId: "",
  discordNick: "",
  discordId: "",
  robloxNick: "",
  age: "",
  answers: {},
});

// stałe klasy poza komponentami: nie tworzą się od nowa przy każdym naciśnięciu klawisza
const GRAD = "linear-gradient(90deg, var(--ac), var(--ac2))";
const card = "rounded-2xl border border-[var(--rk-line)] bg-[var(--rk-card)]";
const inputCls =
  "w-full rounded-xl border border-[var(--rk-line)] bg-[var(--rk-field)] px-4 py-3 text-[15px] text-[var(--rk-fg)] outline-none transition-colors placeholder:text-[var(--rk-mut)] focus:border-[var(--ac)] focus:ring-2 focus:ring-[var(--ac)]/30";
const labelCls = "mb-1.5 block text-sm font-semibold text-[var(--rk-fg2)]";
const ringBad = "ring-2 ring-red-500/60";
const lenOf = (s: string | undefined) => (s ?? "").trim().length;

function RecruitPage() {
  const data = Route.useLoaderData();
  if (data.state !== "ok") {
    return (
      <main className="rk grid min-h-screen place-items-center bg-[var(--rk-bg)] px-5 text-center text-[var(--rk-fg)]">
        <div>
          <p className="text-6xl">📭</p>
          <h1 className="mt-4 text-2xl font-bold">Rekrutacja jest niedostępna</h1>
          <p className="mt-2 text-[var(--rk-mut)]">
            Ten link nie prowadzi do aktywnej strony rekrutacyjnej.
          </p>
        </div>
        <RkTools />
      </main>
    );
  }
  return <Page d={data} />;
}

// ---------- sekcje statyczne: memo, żeby pisanie w formularzu nie przerysowywało całej strony ----------
const Header = memo(function Header({ d }: { d: Ok }) {
  const icon = d.guild.icon
    ? `https://cdn.discordapp.com/icons/${d.guild.id}/${d.guild.icon}.png?size=64`
    : "";
  return (
    <header className="animate-fade-up mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
      <a href="#top" className="flex items-center gap-3 font-bold">
        {icon ? (
          <img src={icon} alt="" width={36} height={36} className="size-9 rounded-xl" />
        ) : (
          <span
            className="grid size-9 place-items-center rounded-xl text-lg"
            style={{ background: GRAD }}
          >
            ★
          </span>
        )}
        <span>{d.guild.name}</span>
      </a>
      <nav className="flex items-center gap-5 text-sm font-semibold text-[var(--rk-fg2)]">
        <a href="#jak" className="hidden hover:text-[var(--rk-fg)] sm:inline">
          Jak aplikować
        </a>
        <a href="#formularz" className="hover:text-[var(--rk-fg)]">
          Rekrutacja
        </a>
        {d.site.discord && (
          <a
            href={d.site.discord}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[var(--rk-line)] px-3 py-1.5 hover:bg-[var(--rk-hover)]"
          >
            Discord ↗
          </a>
        )}
      </nav>
    </header>
  );
});

const HeroTop = memo(function HeroTop({ d }: { d: Ok }) {
  const { site } = d;
  return (
    <>
      {site.banner && (
        <img
          src={site.banner}
          alt=""
          decoding="async"
          fetchPriority="high"
          className="mb-8 h-44 w-full rounded-3xl border border-[var(--rk-line)] object-cover sm:h-64"
        />
      )}
      <p
        className="animate-fade-up text-xs font-bold uppercase tracking-[0.3em] text-[var(--rk-mut)]"
        style={{ animationDelay: "80ms" }}
      >
        Rekrutacja do ekipy
      </p>
      <h1
        className="animate-fade-up mt-3 text-4xl font-extrabold leading-[1.05] sm:text-6xl"
        style={{ animationDelay: "160ms" }}
      >
        <span className="rk-grad-text">{site.title}</span>
      </h1>
      <p
        className="animate-fade-up mt-5 max-w-2xl whitespace-pre-line text-lg text-[var(--rk-fg2)]"
        style={{ animationDelay: "240ms" }}
      >
        {site.intro}
      </p>
      <div
        className="animate-fade-up mt-7 flex flex-wrap gap-3"
        style={{ animationDelay: "320ms" }}
      >
        <a href="#formularz" className="rk-btn rounded-xl px-6 py-3 font-bold text-white shadow-lg">
          Wypełnij podanie ↗
        </a>
        {site.discord && (
          <a
            href={site.discord}
            target="_blank"
            rel="noreferrer"
            className="rk-lift rounded-xl border border-[var(--rk-line)] px-6 py-3 font-bold hover:bg-[var(--rk-hover)]"
          >
            Dołącz na Discord ↗
          </a>
        )}
      </div>
    </>
  );
});

// jedyna część hero zależna od wpisywanych odpowiedzi (licznik „twoje odpowiedzi”)
const Stats = memo(function Stats({
  d,
  count,
  done,
}: {
  d: Ok;
  count: number | null;
  done: number;
}) {
  const open = d.positions.filter((p) => p.open).length;
  const items = [
    [count === null ? "—" : String(count), "pytań na to stanowisko"],
    [String(open), "otwartych stanowisk"],
    [d.site.minChars ? `${d.site.minChars}+` : "—", "znaków w odpowiedzi"],
    [count === null ? "—" : `${done} / ${count}`, "twoje odpowiedzi"],
  ] as const;
  return (
    <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([v, l], n) => (
        <div
          key={l}
          className={`${card} card-lift rk-reveal p-4`}
          style={{ ["--d" as string]: `${n * 90}ms` }}
        >
          <dt className="text-2xl font-extrabold" style={{ color: "var(--ac)" }}>
            {v}
          </dt>
          <dd className="text-xs uppercase tracking-wider text-[var(--rk-mut)]">{l}</dd>
        </div>
      ))}
    </dl>
  );
});

const STEPS = [
  [
    "1",
    "Powiedz nam o sobie",
    "Podaj nick Discord i Roblox, wiek oraz stanowisko, o które się ubiegasz.",
  ],
  [
    "2",
    "Pokaż, co potrafisz",
    "Odpowiedz własnymi słowami na pytania – bez kopiowania i bez pośpiechu.",
  ],
  ["3", "Poczekaj na decyzję", "Ekipa rozpatrzy podanie, a odpowiedź dostaniesz na Discordzie."],
] as const;
const Steps = memo(function Steps() {
  return (
    <section id="jak" className="rk-cv mx-auto max-w-5xl px-5 py-10">
      <h2 className="rk-reveal text-2xl font-extrabold">Jak aplikować</h2>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {STEPS.map(([n, t, x], k) => (
          <li
            key={n}
            className={`${card} card-lift rk-reveal p-5`}
            style={{ ["--d" as string]: `${k * 120}ms` }}
          >
            <span
              className="grid size-9 place-items-center rounded-full font-extrabold text-white"
              style={{ background: GRAD }}
            >
              {n}
            </span>
            <h3 className="mt-3 font-bold">{t}</h3>
            <p className="mt-1 text-sm text-[var(--rk-mut)]">{x}</p>
          </li>
        ))}
      </ol>
    </section>
  );
});

const Faq = memo(function Faq({ faq }: { faq: Ok["site"]["faq"] }) {
  if (!faq.length) return null;
  return (
    <section className="rk-cv mx-auto max-w-3xl px-5 py-10">
      <h2 className="rk-reveal text-2xl font-extrabold">Masz pytania?</h2>
      <div className="mt-4 space-y-2">
        {faq.map((f) => (
          <details key={f.q} className={`${card} rk-reveal group p-4`}>
            <summary className="cursor-pointer list-none font-bold marker:hidden">
              <span
                className="mr-2 inline-block transition-transform group-open:rotate-90"
                style={{ color: "var(--ac)" }}
              >
                ▸
              </span>
              {f.q}
            </summary>
            <p className="mt-2 whitespace-pre-line pl-5 text-sm text-[var(--rk-fg2)]">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
});

const Footer = memo(function Footer({ d, guildId }: { d: Ok; guildId: string }) {
  return (
    <footer className="rk-cv mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 border-t border-[var(--rk-line)] px-5 py-8 text-sm text-[var(--rk-mut)]">
      <span>
        © {new Date().getFullYear()} {d.guild.name} · rekrutacja przez Emergency Hamburg Bot
      </span>
      <span className="flex gap-4">
        {d.site.discord && (
          <a
            href={d.site.discord}
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--rk-fg2)]"
          >
            Discord
          </a>
        )}
        <Link
          to="/rekrutacja/$guildId/panel"
          params={{ guildId }}
          className="hover:text-[var(--rk-fg2)]"
        >
          Panel ekipy
        </Link>
      </span>
    </footer>
  );
});

// pole pytania: przerysowuje się tylko wtedy, gdy zmienia się jego własna wartość
const QuestionField = memo(function QuestionField({
  q,
  index,
  value,
  minChars,
  flagged,
  onChange,
}: {
  q: Question;
  index: number;
  value: string;
  minChars: number;
  flagged: boolean;
  onChange: (id: string, v: string) => void;
}) {
  const n = lenOf(value);
  const short = n > 0 && n < minChars;
  const valid = n === 0 ? !q.required : n >= minChars && n <= MAX_ANSWER[q.style];
  return (
    <div id={`field-q-${q.id}`} className={`rounded-xl ${flagged ? ringBad : ""}`}>
      <label className={labelCls}>
        <span style={{ color: "var(--ac)" }}>{index + 1}.</span> {q.label}
        {!q.required && <span className="font-normal text-[var(--rk-mut)]"> (opcjonalnie)</span>}
      </label>
      {q.style === "long" ? (
        <textarea
          className={`${inputCls} min-h-32 resize-y`}
          maxLength={MAX_ANSWER.long}
          value={value}
          onChange={(e) => onChange(q.id, e.target.value)}
          placeholder={q.placeholder}
        />
      ) : (
        <input
          className={inputCls}
          maxLength={MAX_ANSWER.short}
          value={value}
          onChange={(e) => onChange(q.id, e.target.value)}
          placeholder={q.placeholder}
        />
      )}
      <p
        className={`mt-1 text-xs ${short ? "text-amber-300" : valid && n ? "text-emerald-400" : "text-[var(--rk-mut)]"}`}
      >
        {n}
        {minChars ? ` / min. ${minChars}` : ""} znaków{" "}
        {short ? "— napisz trochę więcej" : n ? "✓" : ""}
      </p>
    </div>
  );
});

function Page({ d }: { d: Ok }) {
  const { guildId } = Route.useParams();
  const { site } = d;
  const accent = useMemo(
    () =>
      ({
        ["--ac" as string]: site.accent,
        ["--ac2" as string]: site.accent2,
      }) as React.CSSProperties,
    [site.accent, site.accent2],
  );
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [agree, setAgree] = useState(false);
  const [tabs, setTabs] = useState(0);
  const [website, setWebsite] = useState(""); // pułapka na boty
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const loaded = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;

  // szkic zapisywany w przeglądarce kandydata (nic nie trafia na serwer, dopóki nie kliknie „Wyślij”)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(guildId));
      if (raw) setDraft({ ...emptyDraft(), ...(JSON.parse(raw) as Partial<Draft>) });
    } catch {
      /* brak dostępu do pamięci przeglądarki */
    }
    loaded.current = true;
  }, [guildId]);
  // zapis z opóźnieniem (nie przy każdym klawiszu – localStorage jest synchroniczny) i przy zamykaniu karty
  useEffect(() => {
    if (!loaded.current) return;
    const write = () => {
      try {
        localStorage.setItem(draftKey(guildId), JSON.stringify(latest.current));
      } catch {
        /* ignorujemy */
      }
    };
    const t = setTimeout(write, 500);
    window.addEventListener("pagehide", write);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pagehide", write);
    };
  }, [draft, guildId]);
  // licznik przełączeń kart: tylko informacja dla rekrutera
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && setTabs((n) => n + 1);
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((x) => ({ ...x, [k]: v }));
  const setAnswer = useCallback(
    (id: string, v: string) => setDraft((x) => ({ ...x, answers: { ...x.answers, [id]: v } })),
    [],
  );

  // każde stanowisko ma własne pytania: formularz pokazuje te z wybranego stanowiska
  const qs = useMemo(
    () => d.positions.find((p) => p.id === draft.positionId)?.questions ?? [],
    [d.positions, draft.positionId],
  );
  const done = useMemo(
    () => qs.filter((q) => lenOf(draft.answers[q.id]) >= Math.max(1, site.minChars)).length,
    [qs, draft.answers, site.minChars],
  );
  const missing = useMemo(() => {
    const list: string[] = [];
    if (!draft.positionId) list.push("field-position");
    if (draft.discordNick.trim().length < NICK.discord[0]) list.push("field-discord");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(draft.robloxNick.trim())) list.push("field-roblox");
    const age = Number(draft.age);
    if (!(age >= NICK.age[0] && age <= NICK.age[1])) list.push("field-age");
    for (const q of qs) {
      const n = lenOf(draft.answers[q.id]);
      if (!(n === 0 ? !q.required : n >= site.minChars && n <= MAX_ANSWER[q.style]))
        list.push(`field-q-${q.id}`);
    }
    if (!agree) list.push("field-agree");
    return list;
  }, [draft, agree, qs, site.minChars]);
  const flagged = useMemo(
    () => (errors.length ? new Set(missing) : new Set<string>()),
    [errors, missing],
  );

  const jump = () => {
    const el = missing[0] ? document.getElementById(missing[0]) : null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el?.querySelector("input,textarea,select") as HTMLElement | null)?.focus({
      preventScroll: true,
    });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missing.length) {
      setErrors(["Uzupełnij zaznaczone pola, zanim wyślesz podanie."]);
      return jump();
    }
    setState("sending");
    setErrors([]);
    try {
      await submitApplication({
        data: {
          guildId,
          positionId: draft.positionId,
          discordNick: draft.discordNick,
          discordId: draft.discordId,
          robloxNick: draft.robloxNick,
          age: Number(draft.age),
          answers: draft.answers,
          agree,
          tabSwitches: tabs,
          website,
        },
      });
      try {
        localStorage.removeItem(draftKey(guildId));
      } catch {
        /* ignorujemy */
      }
      loaded.current = false; // po wysłaniu nie zapisujemy szkicu ponownie
      setState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrors(
        String(err instanceof Error ? err.message : "Nie udało się wysłać podania").split("\n"),
      );
      setState("idle");
    }
  }

  const bad = (id: string) => (flagged.has(id) ? ringBad : "");

  return (
    <main
      style={accent}
      className="rk min-h-screen bg-[var(--rk-bg)] text-[var(--rk-fg)] selection:bg-[var(--ac)]/40"
    >
      <div aria-hidden className="rk-bg" />
      <div aria-hidden className="rk-orb rk-orb-a" />
      <div aria-hidden className="rk-orb rk-orb-b" />
      <div className="relative z-10">
        <div className="rk-bar h-1.5 w-full" />
        <Header d={d} />

        <section id="top" className="mx-auto max-w-5xl px-5 pb-6 pt-8 sm:pt-14">
          <HeroTop d={d} />
          <Stats d={d} count={draft.positionId ? qs.length : null} done={done} />
        </section>

        <Steps />

        {/* FORMULARZ */}
        <section id="formularz" className="mx-auto max-w-3xl scroll-mt-6 px-5 py-10">
          {state === "done" ? (
            <div className={`${card} animate-fade-up p-8 text-center`}>
              <p className="text-5xl">🎉</p>
              <h2 className="mt-3 text-3xl font-extrabold">Rekrutacja wysłana!</h2>
              <p className="mx-auto mt-3 max-w-md text-[var(--rk-fg2)]">{site.successText}</p>
              {site.discord && (
                <a
                  href={site.discord}
                  target="_blank"
                  rel="noreferrer"
                  className="rk-btn mt-6 inline-block rounded-xl px-6 py-3 font-bold text-white"
                >
                  Dołącz na Discord ↗
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={submit} noValidate className={`${card} p-5 sm:p-8`}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-extrabold">Twoje podanie</h2>
                  <p className="text-sm text-[var(--rk-mut)]">
                    Szkic zapisuje się automatycznie w tej przeglądarce.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--rk-line)] px-3 py-1.5 text-xs font-semibold text-[var(--rk-fg2)] hover:bg-[var(--rk-hover)]"
                  onClick={() => {
                    setDraft(emptyDraft());
                    setAgree(false);
                    setErrors([]);
                  }}
                >
                  🗑 Wyczyść szkic
                </button>
              </div>

              <div
                className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--rk-hover)]"
                aria-hidden
              >
                <div
                  className="rk-fill h-full w-full origin-left rounded-full transition-transform duration-500"
                  style={{
                    transform: `scaleX(${qs.length ? done / qs.length : 0})`,
                  }}
                />
              </div>

              {!d.open && (
                <p className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm font-semibold text-amber-200">
                  🔒 Rekrutacja jest teraz zamknięta. Wróć tu później.
                </p>
              )}

              <fieldset
                disabled={!d.open || state === "sending"}
                className="mt-6 space-y-5 disabled:opacity-60"
              >
                <div id="field-position" className={`rounded-xl ${bad("field-position")}`}>
                  <label className={labelCls}>👤 Stanowisko</label>
                  <select
                    className={inputCls}
                    value={draft.positionId}
                    onChange={(e) => set("positionId", e.target.value)}
                  >
                    <option value="">— wybierz stanowisko —</option>
                    {d.positions.map((p) => (
                      <option key={p.id} value={p.id} disabled={!p.open}>
                        {p.emoji ? `${p.emoji} ` : ""}
                        {p.label}
                        {p.desc ? ` — ${p.desc}` : ""}
                        {p.open ? "" : " (zamknięte)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div id="field-discord" className={`rounded-xl ${bad("field-discord")}`}>
                    <label className={labelCls}>Nick Discord</label>
                    <input
                      className={inputCls}
                      maxLength={NICK.discord[1]}
                      value={draft.discordNick}
                      onChange={(e) => set("discordNick", e.target.value)}
                      placeholder="np. jan_kowalski"
                      autoComplete="off"
                    />
                  </div>
                  <div id="field-roblox" className={`rounded-xl ${bad("field-roblox")}`}>
                    <label className={labelCls}>Nick Roblox</label>
                    <input
                      className={inputCls}
                      maxLength={NICK.roblox[1]}
                      value={draft.robloxNick}
                      onChange={(e) => set("robloxNick", e.target.value)}
                      placeholder="np. JanK_2008"
                      autoComplete="off"
                    />
                  </div>
                  <div id="field-age" className={`rounded-xl ${bad("field-age")}`}>
                    <label className={labelCls}>Wiek</label>
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      maxLength={2}
                      value={draft.age}
                      onChange={(e) => set("age", e.target.value.replace(/\D/g, ""))}
                      placeholder="np. 16"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      ID Discord{" "}
                      <span className="font-normal text-[var(--rk-mut)]">(opcjonalnie)</span>
                    </label>
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      maxLength={20}
                      value={draft.discordId}
                      onChange={(e) => set("discordId", e.target.value.replace(/\D/g, ""))}
                      placeholder="do wiadomości o decyzji i rangi"
                    />
                  </div>
                </div>

                {!draft.positionId && (
                  <p className="rounded-xl border border-dashed border-[var(--rk-line)] p-4 text-sm text-[var(--rk-mut)]">
                    👆 Wybierz stanowisko – każde ma własne pytania, które pojawią się tutaj.
                  </p>
                )}
                {qs.map((q, i) => (
                  <QuestionField
                    key={q.id}
                    q={q}
                    index={i}
                    value={draft.answers[q.id] ?? ""}
                    minChars={site.minChars}
                    flagged={flagged.has(`field-q-${q.id}`)}
                    onChange={setAnswer}
                  />
                ))}

                {/* pułapka na boty: ukryte pole poza ekranem */}
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  name="website"
                />

                <label
                  id="field-agree"
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--rk-line)] bg-[var(--rk-card)] p-4 text-sm text-[var(--rk-fg2)] ${bad("field-agree")}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--ac)]"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  🔒 Potwierdzam, że odpowiedzi napisałem(-am) samodzielnie i nie są spamem.
                </label>
              </fieldset>

              {errors.length > 0 && (
                <ul
                  className="mt-5 space-y-1 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
                  role="alert"
                >
                  {errors.map((m) => (
                    <li key={m}>⚠️ {m}</li>
                  ))}
                </ul>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={!d.open || state === "sending"}
                  className="rk-btn rounded-xl px-7 py-3.5 font-extrabold uppercase tracking-wide text-white shadow-lg disabled:opacity-50"
                >
                  {state === "sending" ? "Wysyłanie…" : "📤 Wyślij rekrutację"}
                </button>
                {missing.length > 0 && (
                  <button
                    type="button"
                    onClick={jump}
                    className="text-sm font-semibold text-[var(--rk-fg2)] underline-offset-4 hover:underline"
                  >
                    Przejdź do brakującego ({missing.length})
                  </button>
                )}
                {tabs > 0 && (
                  <span className="ml-auto text-xs text-[var(--rk-mut)]">
                    Przełączenia kart: {tabs}
                  </span>
                )}
              </div>
            </form>
          )}
        </section>

        <Faq faq={site.faq} />
        <Footer d={d} guildId={guildId} />
      </div>
      <RkTools music={site.music} />
    </main>
  );
}
