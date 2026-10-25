import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getGuild, getMe, saveGuild, sendPanel, startTrial } from "@/lib/dashboard.functions";
import {
  CATEGORIES,
  CHANNEL_SECTIONS,
  ROLE_FIELDS,
  NUM_FIELDS,
  PANEL_SLOTS,
  type Category,
} from "@/lib/bot-slots";
import { SiteHeader, LoginButton, inviteUrl } from "@/components/site";
import { ContentEditor } from "@/components/content-editor";
import { RecruitSiteEditor } from "@/components/recruit-site-editor";
import {
  Block,
  ChannelField,
  NumField,
  PanelSender,
  Progress,
  RolePicker,
} from "@/components/config-ui";
import { MessageComposer } from "@/components/message-composer";
import { readContent } from "@/lib/content-config";
import { saveContent } from "@/lib/content.functions";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import {
  Save,
  FileText,
  LayoutDashboard,
  ChevronRight,
  Megaphone,
  Gem,
  Monitor,
} from "lucide-react";
import { LockBanner, PremiumBadge, TrialCard } from "@/components/premium-ui";
import { PREMIUM_PANELS } from "@/lib/premium";
import { PremiumPanel } from "@/components/premium-panel";

// pola kanałów, w których wybiera się KATEGORIĘ (folder), a nie zwykły kanał tekstowy
const FOLDER_SLOTS = ["ticketcat", "mafiakat", "firmykat"];

const meQ = queryOptions({ queryKey: ["me"], queryFn: () => getMe() });
const guildQ = (guildId: string) =>
  queryOptions({ queryKey: ["guild", guildId], queryFn: () => getGuild({ data: { guildId } }) });

export const Route = createFileRoute("/dashboard/$guildId")({
  head: () => ({
    meta: [
      { title: "Konfiguracja serwera — Emergency Hamburg Bot" },
      { name: "description", content: "Ustaw kanały, rangi i limity bota dla swojego serwera." },
      { property: "og:title", content: "Konfiguracja serwera — Emergency Hamburg Bot" },
      { property: "og:description", content: "Kanały, rangi i limity bota." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params }) => {
    const me = await context.queryClient.ensureQueryData(meQ);
    if (me.user) await context.queryClient.ensureQueryData(guildQ(params.guildId));
  },
  component: GuildPage,
  errorComponent: ({ error }) => (
    <main className="min-h-screen">
      <SiteHeader user={null} />
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="font-display text-4xl">Nie można otworzyć</h1>
        <p className="mt-2 text-muted-foreground">
          {error instanceof Error ? error.message : "Błąd"}
        </p>
        <Link to="/dashboard" className="mt-6 inline-block font-semibold text-accent">
          ← Wróć do serwerów
        </Link>
      </div>
    </main>
  ),
});

function GuildPage() {
  const { data: me } = useSuspenseQuery(meQ);
  if (!me.user) {
    return (
      <main className="min-h-screen">
        <SiteHeader user={null} />
        <div className="mx-auto max-w-xl px-5 py-16 text-center">
          <LoginButton />
        </div>
      </main>
    );
  }
  return <Editor me={me} />;
}

type View =
  "home" | "embeds" | "composer" | "studio" | "premium" | (typeof CATEGORIES)[number]["id"];

function Editor({ me }: { me: Awaited<ReturnType<typeof getMe>> }) {
  const { guildId } = Route.useParams();
  const { data } = useSuspenseQuery(guildQ(guildId));
  const qc = useQueryClient();

  const [channels, setChannels] = useState<Record<string, string>>(
    data.botIn ? data.config.channels : {},
  );
  const [roles, setRoles] = useState<Record<string, string[] | string>>(
    data.botIn ? data.config.roles : {},
  );
  const [settings, setSettings] = useState<Record<string, number>>(
    data.botIn ? data.config.settings : {},
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [view, setView] = useState<View>("home");
  const [content, setContent] = useState(() => readContent(data.botIn ? data.config.content : {}));
  const [saveError, setSaveError] = useState("");
  const saveContentFn = useServerFn(saveContent);
  const saveGuildFn = useServerFn(saveGuild);
  const sendPanelFn = useServerFn(sendPanel);
  const startTrialFn = useServerFn(startTrial);
  // bezpłatny trial Premium (3 dni): po aktywacji odświeżamy dane serwera, więc od razu odblokowują się funkcje
  async function runTrial() {
    await startTrialFn({ data: { guildId } });
    await qc.invalidateQueries({ queryKey: ["guild", guildId] });
  }
  const [panelStatus, setPanelStatus] = useState<Record<string, "sending" | "sent" | "error">>({});
  const [panelError, setPanelError] = useState<Record<string, string>>({});

  async function sendOne(key: string) {
    setPanelStatus((p) => ({ ...p, [key]: "sending" }));
    try {
      await saveGuildFn({ data: { guildId, channels, roles, settings } });
      await saveContentFn({ data: { guildId, content } });
      await sendPanelFn({ data: { guildId, panel: key } });
      setPanelStatus((p) => ({ ...p, [key]: "sent" }));
    } catch (e) {
      setPanelError((p) => ({
        ...p,
        [key]: e instanceof Error ? e.message : "Nie udało się wysłać panelu",
      }));
      setPanelStatus((p) => ({ ...p, [key]: "error" }));
    }
  }

  if (!data.botIn) {
    return (
      <main className="min-h-screen">
        <SiteHeader user={me.user} isOwner={me.isOwner} />
        <div className="mx-auto max-w-xl px-5 py-16 text-center">
          <h1 className="font-display text-4xl">Bota nie ma na {data.guild.name}</h1>
          {me.clientId && (
            <a
              href={inviteUrl(me.clientId, guildId)}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-block rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground"
            >
              Dodaj bota
            </a>
          )}
        </div>
      </main>
    );
  }

  const premium = data.premium;
  const locked = !premium.active; // plan Free
  const textChannels = data.channels.filter((c) => c.type !== 4);
  const categoryChannels = data.channels.filter((c) => c.type === 4);

  const touch = () => setStatus("idle");
  const rolesOf = (key: string): string[] => {
    const v = roles[key];
    return Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
  };
  const toggleRole = (key: string, id: string, multi: boolean) => {
    touch();
    setRoles((r) => {
      if (!multi) return { ...r, [key]: r[key] === id ? "" : id };
      const cur = Array.isArray(r[key]) ? (r[key] as string[]) : [];
      return { ...r, [key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  };

  // ile pól kategorii (kanały + rangi) jest już ustawionych
  const progressOf = (cat: Category) => {
    const keys = cat.sections.flatMap(
      (id) => CHANNEL_SECTIONS.find((s) => s.id === id)?.slots.map((x) => x[0]) ?? [],
    );
    return {
      done:
        keys.filter((k) => channels[k]).length + cat.roles.filter((k) => rolesOf(k).length).length,
      total: keys.length + cat.roles.length,
    };
  };

  async function save() {
    setStatus("saving");
    try {
      await saveGuildFn({ data: { guildId, channels, roles, settings } });
      await saveContentFn({ data: { guildId, content } });
      await qc.invalidateQueries({ queryKey: ["guild", guildId] });
      setStatus("saved");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Błąd zapisu");
      setStatus("error");
    }
  }

  const cat = CATEGORIES.find((c) => c.id === view);
  const navItem = (id: View, emoji: React.ReactNode, label: string, extra?: React.ReactNode) => (
    <button
      key={id}
      type="button"
      onClick={() => setView(id)}
      aria-current={view === id ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition lg:w-full ${view === id ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card hover:border-primary/40 hover:bg-muted"}`}
    >
      <span className="text-base leading-none">{emoji}</span>
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {extra}
    </button>
  );
  const badge = (c: Category) => {
    const p = progressOf(c);
    const full = p.total > 0 && p.done === p.total;
    return (
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${view === c.id ? "bg-white/20" : full ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}
      >
        {full ? "✓" : `${p.done}/${p.total}`}
      </span>
    );
  };

  return (
    <main className="min-h-screen pb-28">
      <SiteHeader user={me.user} isOwner={me.isOwner} />
      <section className="mx-auto max-w-6xl animate-fade-up px-5 py-8">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Serwery
        </Link>
        <h1 className="mt-2 flex flex-wrap items-center gap-3 font-display text-5xl">
          {data.guild.name}
          {premium.active && <PremiumBadge className="px-3 py-1 text-sm" />}
        </h1>
        {premium.blocked && (
          <div className="mt-4 rounded-xl border border-red-500/50 bg-red-50 p-4 text-sm font-semibold text-red-800">
            ⛔ Ten serwer został zablokowany przez właściciela bota: {premium.blocked.reason}.
            Zapisywanie zmian jest wyłączone.
          </div>
        )}
        {premium.trial.available && !premium.blocked && (
          <div className="mt-4">
            <TrialCard days={premium.trial.days} onStart={runTrial} compact />
          </div>
        )}
        {premium.trial.active && (
          <div className="mt-4 rounded-xl border border-emerald-500/50 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            🎁 Trial Premium: zostało {premium.trial.daysLeft}{" "}
            {premium.trial.daysLeft === 1 ? "dzień" : "dni"}. Później serwer wraca do planu Free
            (dane zostają).{" "}
            <button type="button" onClick={() => setView("premium")} className="underline">
              Jak zostać na Premium
            </button>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[250px_1fr]">
          <nav
            className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-4 lg:flex-col lg:self-start lg:overflow-visible lg:pb-0"
            aria-label="Sekcje konfiguracji"
          >
            {navItem("home", <LayoutDashboard className="size-4" />, "Przegląd")}
            <p className="hidden px-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground lg:block">
              Funkcje bota
            </p>
            {CATEGORIES.map((c) =>
              navItem(
                c.id,
                c.emoji,
                c.label,
                c.premiumOnly && locked ? <span className="text-xs">💎</span> : badge(c),
              ),
            )}
            <p className="hidden px-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground lg:block">
              Wygląd
            </p>
            {navItem("composer", <Megaphone className="size-4" />, "Wysyłanie wiadomości")}
            {navItem(
              "studio",
              <Monitor className="size-4" />,
              "Widok Discorda",
              <span className="text-xs">💎</span>,
            )}
            {navItem("embeds", <FileText className="size-4" />, "Wiadomości bota (embedy)")}
            <p className="hidden px-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground lg:block">
              Plan
            </p>
            {navItem(
              "premium",
              <Gem className="size-4" />,
              "Premium",
              premium.active ? (
                <PremiumBadge />
              ) : (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                  Kup
                </span>
              ),
            )}
          </nav>

          <div className="min-w-0">
            {view === "home" && (
              <div>
                <h2 className="font-display text-4xl">Przegląd konfiguracji</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Bot jest podzielony na funkcje. Wejdź w sekcję, ustaw w niej <b>kanały</b> i{" "}
                  <b>rangi</b>, a potem kliknij <b>Zapisz zmiany</b> na dole. Zielony ptaszek
                  oznacza, że wszystko w sekcji jest ustawione (część pól jest opcjonalna, więc 100%
                  nie jest konieczne).
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {CATEGORIES.map((c) => {
                    const p = progressOf(c);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setView(c.id)}
                        className="card-lift group rounded-xl border bg-card p-5 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-3xl">
                            {c.emoji}
                            {c.premiumOnly && locked && <PremiumBadge />}
                          </span>
                          <ChevronRight className="size-5 text-muted-foreground transition group-hover:translate-x-1" />
                        </div>
                        <h3 className="mt-2 font-display text-2xl">{c.label}</h3>
                        <p className="mb-3 mt-0.5 min-h-10 text-sm text-muted-foreground">
                          {c.desc}
                        </p>
                        <Progress done={p.done} total={p.total} />
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setView("embeds")}
                    className="card-lift group rounded-xl border bg-card p-5 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <FileText className="size-8" />
                      <ChevronRight className="size-5 text-muted-foreground transition group-hover:translate-x-1" />
                    </div>
                    <h3 className="mt-2 font-display text-2xl">Wiadomości bota (embedy)</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Własne tytuły, kolory i obrazki wiadomości bota.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {view === "composer" && (
              <MessageComposer
                guildId={guildId}
                channels={data.channels}
                roles={data.roles}
                premium={premium.active}
                onOpenStudio={() => setView("studio")}
              />
            )}

            {view === "studio" &&
              (premium.active ? (
                <MessageComposer
                  studio
                  guildId={guildId}
                  channels={data.channels}
                  roles={data.roles}
                  premium
                />
              ) : (
                <div>
                  <h2 className="font-display text-4xl">🖥️ Widok Discorda</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Podgląd wiadomości dokładnie tak, jak zobaczą go gracze – na całym ekranie.
                  </p>
                  <div className="mt-4">
                    <LockBanner
                      title="Widok Discorda to funkcja Premium"
                      guildId={guildId}
                      guildName={data.guild.name}
                    >
                      Duże okno serwera z prawdziwym avatarem i nazwą bota, kanałami i kolorami ról,
                      jasny i ciemny motyw, widok na telefonie, pełny ekran (jak film na YouTube)
                      oraz wysyłka wiadomości i embedów z paska na dole okna.
                    </LockBanner>
                  </div>
                </div>
              ))}

            {view === "premium" && (
              <PremiumPanel
                premium={premium}
                guildId={guildId}
                guildName={data.guild.name}
                usage={{
                  recruitPositions: content.recruitment.positions.length,
                  recruitQuestions: content.recruitment.questions.length,
                }}
                onStartTrial={runTrial}
              />
            )}

            {view === "embeds" && locked && (
              <div className="mb-4">
                <LockBanner
                  title="Własny wygląd wiadomości bota to funkcja Premium"
                  guildId={guildId}
                  guildName={data.guild.name}
                >
                  Możesz tu projektować szablony, ale na planie Free nie zostaną zapisane ani
                  zastosowane przez bota.
                </LockBanner>
              </div>
            )}
            {view === "embeds" && (
              <ContentEditor
                guildId={guildId}
                value={content}
                onChange={(v) => {
                  setContent(v);
                  setStatus("idle");
                }}
                roles={data.roles}
                channels={data.channels}
                view="embeds"
              />
            )}

            {cat && (
              <div key={cat.id} className="animate-fade-up">
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-4xl">
                        {cat.emoji} {cat.label}
                      </h2>
                      <p className="text-sm text-muted-foreground">{cat.desc}</p>
                    </div>
                    <div className="w-44">
                      <Progress {...progressOf(cat)} />
                    </div>
                  </div>
                </div>

                {cat.premiumOnly && locked && (
                  <div className="mt-4">
                    <LockBanner
                      title={`${cat.label}: funkcja planu Premium`}
                      guildId={guildId}
                      guildName={data.guild.name}
                    >
                      Możesz już ustawić kanały i rangi, ale panele się nie wyślą, a funkcje na
                      serwerze pozostaną zablokowane do czasu włączenia Premium.
                    </LockBanner>
                  </div>
                )}
                {cat.premiumNote && locked && !cat.premiumOnly && (
                  <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                    💎 {cat.premiumNote}
                  </p>
                )}

                {cat.sections.map((sid) => {
                  const sec = CHANNEL_SECTIONS.find((s) => s.id === sid);
                  if (!sec) return null;
                  return (
                    <Block
                      key={sid}
                      icon="📍"
                      title="Kanały"
                      hint="Wybierz, gdzie bot ma wysyłać wiadomości tej funkcji."
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        {sec.slots.map((slot) => (
                          <ChannelField
                            key={slot[0]}
                            slot={slot}
                            value={channels[slot[0]] ?? ""}
                            options={
                              FOLDER_SLOTS.includes(slot[0]) ? categoryChannels : textChannels
                            }
                            category={FOLDER_SLOTS.includes(slot[0])}
                            onChange={(id) => {
                              touch();
                              setChannels((c) => ({ ...c, [slot[0]]: id }));
                            }}
                          />
                        ))}
                      </div>
                    </Block>
                  );
                })}

                {cat.roles.length > 0 && (
                  <Block
                    icon="🎭"
                    title="Rangi"
                    hint="Zielone rangi u góry są wybrane. Kliknij rangę, aby ją dodać lub odznaczyć."
                  >
                    <div className="space-y-4">
                      {ROLE_FIELDS.filter((f) => cat.roles.includes(f.key)).map((f) => (
                        <RolePicker
                          key={f.key}
                          field={f}
                          roles={data.roles}
                          selected={rolesOf(f.key)}
                          onToggle={(id) => toggleRole(f.key, id, f.multi)}
                        />
                      ))}
                    </div>
                  </Block>
                )}

                {cat.nums.length > 0 && (
                  <Block icon="⚙️" title="Limity">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {NUM_FIELDS.filter((f) => cat.nums.includes(f.key)).map((f) => (
                        <NumField
                          key={f.key}
                          label={f.label}
                          min={f.min ?? 1}
                          max={f.max ?? 365}
                          value={settings[f.key] ?? f.def}
                          onChange={(n) => {
                            touch();
                            setSettings((s) => ({ ...s, [f.key]: n }));
                          }}
                        />
                      ))}
                    </div>
                  </Block>
                )}

                {cat.panels.length > 0 && (
                  <Block
                    icon="📤"
                    title="Wysyłanie paneli"
                    hint="Po ustawieniu kanału kliknij „Wyślij panel”. Zapisuje ustawienia i zleca botowi wysyłkę – panel pojawi się po kilku sekundach."
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PANEL_SLOTS.filter((p) => cat.panels.includes(p.key)).map((p) => (
                        <PanelSender
                          key={p.key}
                          emoji={p.emoji}
                          label={p.label}
                          channelName={
                            channels[p.slot]
                              ? (textChannels.find((c) => c.id === channels[p.slot])?.name ??
                                "ustawiony kanał")
                              : null
                          }
                          status={panelStatus[p.key]}
                          error={panelError[p.key]}
                          locked={locked && (PREMIUM_PANELS as readonly string[]).includes(p.key)}
                          onSend={() => sendOne(p.key)}
                        />
                      ))}
                    </div>
                  </Block>
                )}

                {cat.recruitment && (
                  <Block
                    icon="🧾"
                    title="Formularz i stanowiska"
                    hint={`Stanowiska: ${content.recruitment.positions.length}/${premium.limits.recruitPositions} • Pytania: ${content.recruitment.questions.length}/${premium.limits.recruitQuestions}${content.recruitment.positions.length > premium.limits.recruitPositions || content.recruitment.questions.length > premium.limits.recruitQuestions ? " – przekroczono limit planu, zapis zostanie odrzucony (usuń nadmiar albo kup Premium)" : ""}`}
                  >
                    <ContentEditor
                      guildId={guildId}
                      value={content}
                      onChange={(v) => {
                        setContent(v);
                        setStatus("idle");
                      }}
                      roles={data.roles}
                      channels={data.channels}
                      view="recruitment"
                      limits={premium.limits}
                    />
                  </Block>
                )}

                {cat.recruitment && (
                  <Block
                    icon="🌐"
                    title="Strona rekrutacyjna i panel ekipy"
                    hint={`${premium.recruitSite ? "Premium" : "Wymaga Premium"} • ${content.recruitSite.enabled ? "włączona" : "wyłączona"}`}
                  >
                    <RecruitSiteEditor
                      guildId={guildId}
                      guildName={data.guild.name}
                      value={content}
                      allowed={premium.recruitSite}
                      onChange={(v) => {
                        setContent(v);
                        setStatus("idle");
                      }}
                    />
                  </Block>
                )}

                {cat.tickets && (
                  <Block
                    icon="🎫"
                    title="Rodzaje i formularz ticketów"
                    hint={`Rodzaje w menu: ${content.tickets.positions.length}/${premium.limits.ticketTypes}${content.tickets.positions.length > premium.limits.ticketTypes ? " – przekroczono limit planu, zapis zostanie odrzucony (usuń nadmiar albo kup Premium)" : ""} • Pola formularza: ${content.tickets.questions.length}${content.tickets.images ? " + obrazki" : ""}`}
                  >
                    <ContentEditor
                      guildId={guildId}
                      value={content}
                      onChange={(v) => {
                        setContent(v);
                        setStatus("idle");
                      }}
                      roles={data.roles}
                      channels={data.channels}
                      view="tickets"
                      limits={premium.limits}
                      ticketImages={premium.ticketImages}
                    />
                  </Block>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {status === "saved" ? (
              <span className="animate-fade-up inline-block font-semibold text-emerald-700">
                ✅ Zapisano
              </span>
            ) : status === "error" ? (
              saveError
            ) : (
              "Niezapisane zmiany"
            )}
          </span>
          <Button
            onClick={save}
            disabled={status === "saving"}
            className="rounded-md bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] transition hover:-translate-y-0.5 hover:brightness-110 active:scale-95 disabled:opacity-60"
          >
            <Save />
            {status === "saving" ? "Zapisywanie…" : "Zapisz zmiany"}
          </Button>
        </div>
      </div>
    </main>
  );
}
