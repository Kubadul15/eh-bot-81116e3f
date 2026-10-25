import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPublicRecruit, submitApplication } from "@/lib/recruit-site.functions";
import { MAX_ANSWER, NICK } from "@/lib/recruit-logic";
import type { PublicRecruit } from "@/lib/recruit-types";

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

function RecruitPage() {
  const data = Route.useLoaderData();
  if (data.state !== "ok") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#080b16] px-5 text-center text-slate-100">
        <div>
          <p className="text-6xl">📭</p>
          <h1 className="mt-4 text-2xl font-bold">Rekrutacja jest niedostępna</h1>
          <p className="mt-2 text-slate-400">
            Ten link nie prowadzi do aktywnej strony rekrutacyjnej.
          </p>
        </div>
      </main>
    );
  }
  return <Page d={data} />;
}

function Page({ d }: { d: Ok }) {
  const { guildId } = Route.useParams();
  const { site } = d;
  const accent = {
    ["--ac" as string]: site.accent,
    ["--ac2" as string]: site.accent2,
  } as React.CSSProperties;
  const grad = "linear-gradient(90deg, var(--ac), var(--ac2))";
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [agree, setAgree] = useState(false);
  const [tabs, setTabs] = useState(0);
  const [website, setWebsite] = useState(""); // pułapka na boty
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const loaded = useRef(false);

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
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(draftKey(guildId), JSON.stringify(draft));
    } catch {
      /* ignorujemy */
    }
  }, [draft, guildId]);
  // licznik przełączeń kart: tylko informacja dla rekrutera
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && setTabs((n) => n + 1);
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((x) => ({ ...x, [k]: v }));
  const setAnswer = (id: string, v: string) =>
    setDraft((x) => ({ ...x, answers: { ...x.answers, [id]: v } }));

  const openPositions = d.positions.filter((p) => p.open);
  const len = (id: string) => (draft.answers[id] ?? "").trim().length;
  const answerOk = (q: Ok["questions"][number]) => {
    const n = len(q.id);
    return n === 0 ? !q.required : n >= site.minChars && n <= MAX_ANSWER[q.style];
  };
  const done = d.questions.filter((q) => len(q.id) >= Math.max(1, site.minChars)).length;
  const missing = useMemo(() => {
    const list: string[] = [];
    if (!draft.positionId) list.push("field-position");
    if (draft.discordNick.trim().length < NICK.discord[0]) list.push("field-discord");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(draft.robloxNick.trim())) list.push("field-roblox");
    const age = Number(draft.age);
    if (!(age >= NICK.age[0] && age <= NICK.age[1])) list.push("field-age");
    for (const q of d.questions) {
      const n = (draft.answers[q.id] ?? "").trim().length;
      if (!(n === 0 ? !q.required : n >= site.minChars && n <= MAX_ANSWER[q.style]))
        list.push(`field-q-${q.id}`);
    }
    if (!agree) list.push("field-agree");
    return list;
  }, [draft, agree, d.questions, site.minChars]);

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
      setState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrors(
        String(err instanceof Error ? err.message : "Nie udało się wysłać podania").split("\n"),
      );
      setState("idle");
    }
  }

  const card = "rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur";
  const input =
    "w-full rounded-xl border border-white/10 bg-[#0c1222] px-4 py-3 text-[15px] text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-[var(--ac)] focus:ring-2 focus:ring-[var(--ac)]/30";
  const label = "mb-1.5 block text-sm font-semibold text-slate-200";
  const bad = (id: string) =>
    errors.length && missing.includes(id) ? "ring-2 ring-red-500/60" : "";
  const icon = d.guild.icon
    ? `https://cdn.discordapp.com/icons/${d.guild.id}/${d.guild.icon}.png?size=128`
    : "";

  return (
    <main
      style={accent}
      className="min-h-screen scroll-smooth bg-[#080b16] text-slate-100 selection:bg-[var(--ac)]/40"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 40% at 0% 0%, color-mix(in srgb, var(--ac) 22%, transparent), transparent 70%), radial-gradient(60% 40% at 100% 0%, color-mix(in srgb, var(--ac2) 22%, transparent), transparent 70%)",
        }}
      />
      <div className="relative z-10">
        <div className="h-1.5 w-full" style={{ background: grad }} />
        <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <a href="#top" className="flex items-center gap-3 font-bold">
            {icon ? (
              <img src={icon} alt="" className="size-9 rounded-xl" />
            ) : (
              <span
                className="grid size-9 place-items-center rounded-xl text-lg"
                style={{ background: grad }}
              >
                ★
              </span>
            )}
            <span>{d.guild.name}</span>
          </a>
          <nav className="flex items-center gap-5 text-sm font-semibold text-slate-300">
            <a href="#jak" className="hidden hover:text-white sm:inline">
              Jak aplikować
            </a>
            <a href="#formularz" className="hover:text-white">
              Rekrutacja
            </a>
            {site.discord && (
              <a
                href={site.discord}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/10"
              >
                Discord ↗
              </a>
            )}
          </nav>
        </header>

        {/* HERO */}
        <section id="top" className="mx-auto max-w-5xl px-5 pb-6 pt-8 sm:pt-14">
          {site.banner && (
            <img
              src={site.banner}
              alt=""
              className="mb-8 h-44 w-full rounded-3xl border border-white/10 object-cover sm:h-64"
            />
          )}
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">
            Rekrutacja do ekipy
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            <span style={{ background: grad, WebkitBackgroundClip: "text", color: "transparent" }}>
              {site.title}
            </span>
          </h1>
          <p className="mt-5 max-w-2xl whitespace-pre-line text-lg text-slate-300">{site.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#formularz"
              className="rounded-xl px-6 py-3 font-bold text-white shadow-lg transition hover:brightness-110"
              style={{ background: grad }}
            >
              Wypełnij podanie ↗
            </a>
            {site.discord && (
              <a
                href={site.discord}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/15 px-6 py-3 font-bold hover:bg-white/10"
              >
                Dołącz na Discord ↗
              </a>
            )}
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [String(d.questions.length), "pytań w formularzu"],
              [String(openPositions.length), "otwartych stanowisk"],
              [site.minChars ? `${site.minChars}+` : "—", "znaków w odpowiedzi"],
              [`${done} / ${d.questions.length}`, "twoje odpowiedzi"],
            ].map(([v, l]) => (
              <div key={l} className={`${card} p-4`}>
                <dt className="text-2xl font-extrabold" style={{ color: "var(--ac)" }}>
                  {v}
                </dt>
                <dd className="text-xs uppercase tracking-wider text-slate-400">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* JAK TO DZIAŁA */}
        <section id="jak" className="mx-auto max-w-5xl px-5 py-10">
          <h2 className="text-2xl font-extrabold">Jak aplikować</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
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
              [
                "3",
                "Poczekaj na decyzję",
                "Ekipa rozpatrzy podanie, a odpowiedź dostaniesz na Discordzie.",
              ],
            ].map(([n, t, x]) => (
              <li key={n} className={`${card} p-5`}>
                <span
                  className="grid size-9 place-items-center rounded-full font-extrabold text-white"
                  style={{ background: grad }}
                >
                  {n}
                </span>
                <h3 className="mt-3 font-bold">{t}</h3>
                <p className="mt-1 text-sm text-slate-400">{x}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FORMULARZ */}
        <section id="formularz" className="mx-auto max-w-3xl scroll-mt-6 px-5 py-10">
          {state === "done" ? (
            <div className={`${card} p-8 text-center`}>
              <p className="text-5xl">🎉</p>
              <h2 className="mt-3 text-3xl font-extrabold">Rekrutacja wysłana!</h2>
              <p className="mx-auto mt-3 max-w-md text-slate-300">{site.successText}</p>
              {site.discord && (
                <a
                  href={site.discord}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-block rounded-xl px-6 py-3 font-bold text-white"
                  style={{ background: grad }}
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
                  <p className="text-sm text-slate-400">
                    Szkic zapisuje się automatycznie w tej przeglądarce.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                  onClick={() => {
                    setDraft(emptyDraft());
                    setAgree(false);
                    setErrors([]);
                  }}
                >
                  🗑 Wyczyść szkic
                </button>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${d.questions.length ? (done / d.questions.length) * 100 : 0}%`,
                    background: grad,
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
                  <label className={label}>👤 Stanowisko</label>
                  <select
                    className={input}
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
                    <label className={label}>Nick Discord</label>
                    <input
                      className={input}
                      maxLength={NICK.discord[1]}
                      value={draft.discordNick}
                      onChange={(e) => set("discordNick", e.target.value)}
                      placeholder="np. jan_kowalski"
                      autoComplete="off"
                    />
                  </div>
                  <div id="field-roblox" className={`rounded-xl ${bad("field-roblox")}`}>
                    <label className={label}>Nick Roblox</label>
                    <input
                      className={input}
                      maxLength={NICK.roblox[1]}
                      value={draft.robloxNick}
                      onChange={(e) => set("robloxNick", e.target.value)}
                      placeholder="np. JanK_2008"
                      autoComplete="off"
                    />
                  </div>
                  <div id="field-age" className={`rounded-xl ${bad("field-age")}`}>
                    <label className={label}>Wiek</label>
                    <input
                      className={input}
                      inputMode="numeric"
                      maxLength={2}
                      value={draft.age}
                      onChange={(e) => set("age", e.target.value.replace(/\D/g, ""))}
                      placeholder="np. 16"
                    />
                  </div>
                  <div>
                    <label className={label}>
                      ID Discord <span className="font-normal text-slate-500">(opcjonalnie)</span>
                    </label>
                    <input
                      className={input}
                      inputMode="numeric"
                      maxLength={20}
                      value={draft.discordId}
                      onChange={(e) => set("discordId", e.target.value.replace(/\D/g, ""))}
                      placeholder="do wiadomości o decyzji i rangi"
                    />
                  </div>
                </div>

                {d.questions.map((q, i) => {
                  const n = len(q.id);
                  const short = n > 0 && n < site.minChars;
                  return (
                    <div
                      key={q.id}
                      id={`field-q-${q.id}`}
                      className={`rounded-xl ${bad(`field-q-${q.id}`)}`}
                    >
                      <label className={label}>
                        <span style={{ color: "var(--ac)" }}>{i + 1}.</span> {q.label}
                        {!q.required && (
                          <span className="font-normal text-slate-500"> (opcjonalnie)</span>
                        )}
                      </label>
                      {q.style === "long" ? (
                        <textarea
                          className={`${input} min-h-32 resize-y`}
                          maxLength={MAX_ANSWER.long}
                          value={draft.answers[q.id] ?? ""}
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          placeholder={q.placeholder}
                        />
                      ) : (
                        <input
                          className={input}
                          maxLength={MAX_ANSWER.short}
                          value={draft.answers[q.id] ?? ""}
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          placeholder={q.placeholder}
                        />
                      )}
                      <p
                        className={`mt-1 text-xs ${short ? "text-amber-300" : answerOk(q) && n ? "text-emerald-400" : "text-slate-500"}`}
                      >
                        {n}
                        {site.minChars ? ` / min. ${site.minChars}` : ""} znaków{" "}
                        {short ? "— napisz trochę więcej" : n ? "✓" : ""}
                      </p>
                    </div>
                  );
                })}

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
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300 ${bad("field-agree")}`}
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
                  className="rounded-xl px-7 py-3.5 font-extrabold uppercase tracking-wide text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
                  style={{ background: grad }}
                >
                  {state === "sending" ? "Wysyłanie…" : "📤 Wyślij rekrutację"}
                </button>
                {missing.length > 0 && (
                  <button
                    type="button"
                    onClick={jump}
                    className="text-sm font-semibold text-slate-300 underline-offset-4 hover:underline"
                  >
                    Przejdź do brakującego ({missing.length})
                  </button>
                )}
                {tabs > 0 && (
                  <span className="ml-auto text-xs text-slate-500">Przełączenia kart: {tabs}</span>
                )}
              </div>
            </form>
          )}
        </section>

        {/* FAQ */}
        {site.faq.length > 0 && (
          <section className="mx-auto max-w-3xl px-5 py-10">
            <h2 className="text-2xl font-extrabold">Masz pytania?</h2>
            <div className="mt-4 space-y-2">
              {site.faq.map((f) => (
                <details key={f.q} className={`${card} group p-4`}>
                  <summary className="cursor-pointer list-none font-bold marker:hidden">
                    <span
                      className="mr-2 inline-block transition group-open:rotate-90"
                      style={{ color: "var(--ac)" }}
                    >
                      ▸
                    </span>
                    {f.q}
                  </summary>
                  <p className="mt-2 whitespace-pre-line pl-5 text-sm text-slate-300">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <footer className="mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-8 text-sm text-slate-500">
          <span>
            © {new Date().getFullYear()} {d.guild.name} · rekrutacja przez Emergency Hamburg Bot
          </span>
          <span className="flex gap-4">
            {site.discord && (
              <a
                href={site.discord}
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-300"
              >
                Discord
              </a>
            )}
            <Link
              to="/rekrutacja/$guildId/panel"
              params={{ guildId }}
              className="hover:text-slate-300"
            >
              Panel ekipy
            </Link>
          </span>
        </footer>
      </div>
    </main>
  );
}
