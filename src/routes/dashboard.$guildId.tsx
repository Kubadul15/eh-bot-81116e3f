import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getGuild, getMe, saveGuild, sendPanel } from "@/lib/dashboard.functions";
import { CHANNEL_SECTIONS, ROLE_FIELDS, NUM_FIELDS, PANEL_SLOTS } from "@/lib/bot-slots";
import { SiteHeader, LoginButton, inviteUrl } from "@/components/site";

const meQ = queryOptions({ queryKey: ["me"], queryFn: () => getMe() });
const guildQ = (guildId: string) => queryOptions({ queryKey: ["guild", guildId], queryFn: () => getGuild({ data: { guildId } }) });

export const Route = createFileRoute("/dashboard/$guildId")({
  head: () => ({
    meta: [
      { title: "Konfiguracja serwera — Emergency Hamburg Bot" },
      { name: "description", content: "Ustaw kanały, rangi i limity bota dla swojego serwera." },
      { property: "og:title", content: "Konfiguracja serwera — Emergency Hamburg Bot" },
      { property: "og:description", content: "Kanały, rangi i limity bota." },
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
  const [panelStatus, setPanelStatus] = useState<Record<string, "sending" | "sent" | "error">>({});

  async function sendOne(key: string) {
    setPanelStatus((p) => ({ ...p, [key]: "sending" }));
    try {
      await sendPanel({ data: { guildId, panel: key } });
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
      await saveGuild({ data: { guildId, channels, roles, settings } });
      await qc.invalidateQueries({ queryKey: ["guild", guildId] });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen pb-28">
      <SiteHeader user={me.user} />
      <section className="hero-glow-soft mx-auto max-w-5xl animate-fade-up px-5 py-6">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Serwery</Link>
        <h1 className="mt-2 font-display text-5xl">{data.guild.name}</h1>
        <p className="text-muted-foreground">Zmiany działają w bocie do 30 sekund po zapisaniu.</p>

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
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {status === "saved" ? <span className="animate-fade-up inline-block">✅ Zapisano</span> : status === "error" ? "❌ Błąd zapisu" : "Pamiętaj o zapisaniu"}
          </span>
          <button
            onClick={save}
            disabled={status === "saving"}
            className="rounded-md bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] transition hover:-translate-y-0.5 hover:brightness-110 active:scale-95 disabled:opacity-60"
          >
            {status === "saving" ? "Zapisywanie…" : "Zapisz"}
          </button>
        </div>
      </div>
    </main>
  );
}
