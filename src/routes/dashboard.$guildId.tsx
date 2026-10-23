import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getGuild, getMe, saveGuild, sendPanel } from "@/lib/dashboard.functions";
import { CHANNEL_SECTIONS, ROLE_FIELDS, NUM_FIELDS, PANEL_SLOTS } from "@/lib/bot-slots";
import { SiteHeader, LoginButton, inviteUrl } from "@/components/site";
import { ContentEditor } from "@/components/content-editor";
import { readContent } from "@/lib/content-config";
import { saveContent } from "@/lib/content.functions";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { Save, Settings2, FileText, Users, Send } from "lucide-react";

const meQ = queryOptions({ queryKey: ["me"], queryFn: () => getMe() });
const guildQ = (guildId: string) => queryOptions({ queryKey: ["guild", guildId], queryFn: () => getGuild({ data: { guildId } }) });

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
        <p className="mt-2 text-muted-foreground">{error instanceof Error ? error.message : "Błąd"}</p>
        <Link to="/dashboard" className="mt-6 inline-block font-semibold text-accent">← Wróć do serwerów</Link>
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
        <div className="mx-auto max-w-xl px-5 py-16 text-center"><LoginButton /></div>
      </main>
    );
  }
  return <Editor me={me} />;
}

function Editor({ me }: { me: Awaited<ReturnType<typeof getMe>> }) {
  const { guildId } = Route.useParams();
  const { data } = useSuspenseQuery(guildQ(guildId));
  const qc = useQueryClient();

  const [channels, setChannels] = useState<Record<string, string>>(data.botIn ? data.config.channels : {});
  const [roles, setRoles] = useState<Record<string, string[] | string>>(data.botIn ? data.config.roles : {});
  const [settings, setSettings] = useState<Record<string, number>>(data.botIn ? data.config.settings : {});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [view, setView] = useState<"settings" | "recruitment" | "embeds" | "panels">("recruitment");
  const [content, setContent] = useState(() => readContent(data.botIn ? data.config.content : {}));
  const [saveError, setSaveError] = useState("");
  const saveContentFn = useServerFn(saveContent);
  const saveGuildFn = useServerFn(saveGuild);
  const sendPanelFn = useServerFn(sendPanel);
  const [panelStatus, setPanelStatus] = useState<Record<string, "sending" | "sent" | "error">>({});

  async function sendOne(key: string) {
    setPanelStatus((p) => ({ ...p, [key]: "sending" }));
    try {
      await saveGuildFn({ data: { guildId, channels, roles, settings } });
      await saveContentFn({ data: { guildId, content } });
      await sendPanelFn({ data: { guildId, panel: key } });
      setPanelStatus((p) => ({ ...p, [key]: "sent" }));
    } catch {
      setPanelStatus((p) => ({ ...p, [key]: "error" }));
    }
  }

  if (!data.botIn) {
    return (
      <main className="min-h-screen">
        <SiteHeader user={me.user} />
        <div className="mx-auto max-w-xl px-5 py-16 text-center">
          <h1 className="font-display text-4xl">Bota nie ma na {data.guild.name}</h1>
          {me.clientId && (
            <a href={inviteUrl(me.clientId, guildId)} target="_blank" rel="noreferrer" className="mt-6 inline-block rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground">
              Dodaj bota
            </a>
          )}
        </div>
      </main>
    );
  }

  const textChannels = data.channels.filter((c) => c.type !== 4);
  const categories = data.channels.filter((c) => c.type === 4);

  const toggleRole = (key: string, id: string, multi: boolean) =>
    setRoles((r) => {
      if (!multi) return { ...r, [key]: r[key] === id ? "" : id };
      const cur = Array.isArray(r[key]) ? (r[key] as string[]) : [];
      return { ...r, [key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });

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

  return (
    <main className="min-h-screen pb-28">
      <SiteHeader user={me.user} />
      <section className="mx-auto max-w-6xl animate-fade-up px-5 py-8">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Serwery</Link>
        <h1 className="mt-2 font-display text-5xl">{data.guild.name}</h1>
        <nav className="my-8 flex flex-wrap gap-2 border-b pb-4" aria-label="Sekcje konfiguracji">
          {([{ id: "recruitment", label: "Rekrutacja", icon: Users }, { id: "embeds", label: "Emb edy".replace(" ", ""), icon: FileText }, { id: "panels", label: "Wysyłanie paneli", icon: Send }, { id: "settings", label: "Ustawienia", icon: Settings2 }] as const).map(item => <Button key={item.id} variant={view === item.id ? "default" : "ghost"} onClick={() => setView(item.id)}><item.icon />{item.label}</Button>)}
        </nav>
        {(view === "recruitment" || view === "embeds") && <ContentEditor guildId={guildId} value={content} onChange={v => { setContent(v); setStatus("idle"); }} roles={data.roles} view={view} />}
        <div hidden={view !== "settings"}>

        <h2 className="mt-10 font-display text-3xl">Kanały</h2>
        <div className="mt-4 space-y-6">
          {CHANNEL_SECTIONS.map((sec) => (
            <div key={sec.name} className="card-lift animate-fade-up rounded-xl border bg-card/80 p-5 backdrop-blur">
              <h3 className="font-bold">{sec.name}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {sec.slots.map(([key, emoji, label, desc]) => {
                  const list = key === "ticketcat" ? categories : textChannels;
                  return (
                    <label key={key} className="block">
                      <span className="text-sm font-semibold">{emoji} {label}</span>
                      <span className="block text-xs text-muted-foreground">{desc}</span>
                      <select
                        value={channels[key] ?? ""}
                        onChange={(e) => setChannels((c) => ({ ...c, [key]: e.target.value }))}
                        className="mt-1 w-full rounded-md border bg-input/30 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/40"
                      >
                        <option value="">— nie ustawiono —</option>
                        {list.map((c) => (
                          <option key={c.id} value={c.id}>{key === "ticketcat" ? "📁 " : "# "}{c.name}</option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-10 font-display text-3xl">Rangi</h2>
        <div className="mt-4 space-y-4">
          {ROLE_FIELDS.map((f) => {
            const val = roles[f.key];
            const sel = f.multi ? (Array.isArray(val) ? val : []) : typeof val === "string" && val ? [val] : [];
            return (
              <div key={f.key} className="card-lift animate-fade-up rounded-xl border bg-card/80 p-5 backdrop-blur">
                <h3 className="font-bold">{f.label}</h3>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.roles.map((r) => {
                    const idx = sel.indexOf(r.id);
                    const on = idx !== -1;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRole(f.key, r.id, f.multi)}
                        className={`rounded-full border px-3 py-1 text-sm transition ${on ? "border-accent bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground hover:border-accent"}`}
                      >
                        {on && f.key === "ranks" ? `${idx + 1}. ` : ""}{r.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        </div>
        <div hidden={view !== "panels"}>
        <h2 className="mt-10 font-display text-3xl">Panele</h2>
        <p className="mt-1 text-sm text-muted-foreground">Wyślij panel na kanał ustawiony powyżej. Bot wyśle go w ciągu ~30 sekund.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PANEL_SLOTS.map((p) => {
            const st = panelStatus[p.key];
            const hasChannel = !!channels[p.slot];
            return (
              <div key={p.key} className="card-lift animate-fade-up rounded-xl border bg-card/80 p-5 backdrop-blur">
                <h3 className="font-bold">{p.emoji} {p.label}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {hasChannel ? `Kanał: #${textChannels.find((c) => c.id === channels[p.slot])?.name ?? "ustawiony"}` : "Najpierw ustaw i zapisz kanał"}
                </p>
                <Button
                  type="button"
                  disabled={!hasChannel || st === "sending"}
                  onClick={() => sendOne(p.key)}
                  className="mt-3 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                   {st === "sending" ? "Wysyłanie…" : st === "sent" ? "✅ Zlecono" : st === "error" ? "❌ Błąd — spróbuj ponownie" : "Wyślij panel"}
                </Button>
              </div>
            );
          })}
        </div>

        </div>
        <div hidden={view !== "settings"}>
        <h2 className="mt-10 font-display text-3xl">Limity</h2>
        <div className="card-lift animate-fade-up mt-4 grid gap-4 rounded-xl border bg-card/80 p-5 sm:grid-cols-2">
          {NUM_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-semibold">{f.label}</span>
              <input
                type="number"
                min={1}
                max={365}
                value={settings[f.key] ?? f.def}
                onChange={(e) => setSettings((s) => ({ ...s, [f.key]: Number(e.target.value) }))}
                className="mt-1 w-full rounded-md border bg-input/30 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/40"
              />
            </label>
          ))}
        </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {status === "saved" ? <span className="animate-fade-up inline-block">✅ Zapisano</span> : status === "error" ? saveError : "Niezapisane zmiany"}
          </span>
          <Button
            onClick={save}
            disabled={status === "saving"}
            className="rounded-md bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] transition hover:-translate-y-0.5 hover:brightness-110 active:scale-95 disabled:opacity-60"
          >
            <Save />{status === "saving" ? "Zapisywanie…" : "Zapisz zmiany"}
          </Button>
        </div>
      </div>
    </main>
  );
}
