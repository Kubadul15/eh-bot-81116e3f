import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, ImagePlus, Plus, Send, Trash2, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RolePicker, type DChannel, type DRole } from "@/components/config-ui";
import {
  composerSchema,
  emptyComposer,
  emptyComposerEmbed,
  embedChars,
  type ComposerEmbed,
  type ComposerMessage,
} from "@/lib/message-config";
import { sendMessage } from "@/lib/message.functions";
import { uploadImage } from "@/lib/content.functions";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Minimalny markdown Discorda do podglądu (tekst jest najpierw escapowany, więc jest bezpieczny).
export const md = (s: string) =>
  esc(s)
    .replace(/```([\s\S]*?)```/g, '<pre class="my-1 rounded bg-black/30 p-2 text-[13px]">$1</pre>')
    .replace(/`([^`\n]+)`/g, '<code class="rounded bg-black/30 px-1 text-[13px]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<span class="text-[#00a8fc]">$1</span>')
    .replace(/\n/g, "<br/>");

const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

function ImageField({
  guildId,
  value,
  onChange,
  placeholder,
}: {
  guildId: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const upload = useServerFn(uploadImage);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const data = new FormData();
      data.set("guildId", guildId);
      data.set("file", file);
      onChange((await upload({ data })).url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nie udało się dodać zdjęcia");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border bg-card px-3 text-sm font-semibold hover:bg-muted">
          <ImagePlus className="size-4" />
          {busy ? "…" : "Wgraj"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </label>
      </div>
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  );
}

// ---------- podgląd w stylu Discorda ----------
function EmbedPreview({ e }: { e: ComposerEmbed }) {
  const empty =
    !e.title && !e.description && !e.image && !e.author && !e.fields.length && !e.footer;
  if (empty) return null;
  return (
    <div
      className="mt-1 max-w-[520px] overflow-hidden rounded bg-[#2b2d31] text-[#dbdee1]"
      style={{ borderLeft: `4px solid ${e.color}` }}
    >
      <div className="flex gap-3 p-3">
        <div className="min-w-0 flex-1">
          {e.author && (
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              {e.authorIcon && (
                <img src={e.authorIcon} alt="" className="size-6 rounded-full object-cover" />
              )}
              {e.author}
            </div>
          )}
          {e.title && (
            <div className="mb-1 break-words font-semibold text-white">
              {e.url ? <span className="text-[#00a8fc]">{e.title}</span> : e.title}
            </div>
          )}
          {e.description && (
            <div
              className="break-words text-sm"
              dangerouslySetInnerHTML={{ __html: md(e.description) }}
            />
          )}
          {e.fields.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
              {e.fields.map((f, i) => (
                <div key={i} className={f.inline ? "col-span-1" : "col-span-3"}>
                  <div
                    className="text-sm font-semibold text-white"
                    dangerouslySetInnerHTML={{ __html: md(f.name) }}
                  />
                  <div className="text-sm" dangerouslySetInnerHTML={{ __html: md(f.value) }} />
                </div>
              ))}
            </div>
          )}
          {e.image && (
            <img src={e.image} alt="" className="mt-3 max-h-72 w-full rounded object-cover" />
          )}
          {(e.footer || e.timestamp) && (
            <div className="mt-2 flex items-center gap-2 text-xs text-[#b5bac1]">
              {e.footerIcon && (
                <img src={e.footerIcon} alt="" className="size-5 rounded-full object-cover" />
              )}
              {[e.footer, e.timestamp ? "dzisiaj" : ""].filter(Boolean).join(" • ")}
            </div>
          )}
        </div>
        {e.thumbnail && (
          <img src={e.thumbnail} alt="" className="size-20 shrink-0 rounded object-cover" />
        )}
      </div>
    </div>
  );
}

function Preview({
  m,
  roles,
  channelName,
}: {
  m: ComposerMessage;
  roles: DRole[];
  channelName: string;
}) {
  const name =
    m.mode === "webhook" ? m.webhookName || "Emergency Hamburg" : "Emergency Hamburg Bot";
  const picked = m.pingRoleIds.map((id) => roles.find((r) => r.id === id)?.name ?? "ranga");
  return (
    <div className="overflow-hidden rounded-xl border bg-[#313338] text-[#dbdee1] shadow-sm">
      <div className="border-b border-black/20 px-4 py-2 text-sm font-semibold text-[#b5bac1]">
        # {channelName || "wybierz-kanal"}
      </div>
      <div className="flex gap-3 p-4">
        {m.mode === "webhook" && m.webhookAvatar ? (
          <img
            src={m.webhookAvatar}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-white">
            {m.mode === "webhook" ? <Webhook className="size-5" /> : <Bot className="size-5" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{name}</span>
            <span className="rounded bg-[#5865f2] px-1 text-[10px] font-bold text-white">
              {m.mode === "webhook" ? "WEBHOOK" : "BOT"}
            </span>
            <span className="text-xs text-[#949ba4]">dzisiaj</span>
          </div>
          {(m.pingEveryone || picked.length > 0 || m.content) && (
            <div className="break-words text-sm">
              {m.pingEveryone && (
                <span className="mr-1 rounded bg-[#5865f2]/30 px-1 text-[#c9cdfb]">@everyone</span>
              )}
              {picked.map((n, i) => (
                <span key={i} className="mr-1 rounded bg-[#5865f2]/30 px-1 text-[#c9cdfb]">
                  @{n}
                </span>
              ))}
              <span dangerouslySetInnerHTML={{ __html: md(m.content) }} />
            </div>
          )}
          {m.embeds.map((e, i) => (
            <EmbedPreview key={i} e={e} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- formularz ----------
export function MessageComposer({
  guildId,
  channels,
  roles,
}: {
  guildId: string;
  channels: DChannel[];
  roles: DRole[];
}) {
  const send = useServerFn(sendMessage);
  const storeKey = `eh-composer:${guildId}`;
  const [m, setM] = useState<ComposerMessage>(() => {
    const fresh = emptyComposer();
    try {
      const d = JSON.parse(
        localStorage.getItem(storeKey) ?? "null",
      ) as Partial<ComposerMessage> | null;
      if (d && typeof d === "object" && Array.isArray(d.embeds))
        return {
          ...fresh,
          ...d,
          embeds: d.embeds.map((e) => ({ ...emptyComposerEmbed(), ...e })).slice(0, 3),
        };
    } catch {
      /* brak szkicu */
    }
    return fresh;
  });
  const [state, setState] = useState<{ kind: "idle" | "sending" | "ok" | "error"; text?: string }>({
    kind: "idle",
  });

  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(m));
    } catch {
      /* np. tryb prywatny */
    }
  }, [m, storeKey]);

  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5);
  const set = (patch: Partial<ComposerMessage>) => {
    setM((x) => ({ ...x, ...patch }));
    setState({ kind: "idle" });
  };
  const setEmbed = (i: number, patch: Partial<ComposerEmbed>) =>
    set({ embeds: m.embeds.map((e, k) => (k === i ? { ...e, ...patch } : e)) });
  const chars = embedChars(m.embeds);

  async function submit() {
    const parsed = composerSchema.safeParse(m);
    if (!parsed.success)
      return setState({
        kind: "error",
        text: parsed.error.issues[0]?.message ?? "Uzupełnij formularz",
      });
    setState({ kind: "sending" });
    try {
      const r = await send({ data: { guildId, message: parsed.data } });
      setState({ kind: "ok", text: r.link });
    } catch (e) {
      setState({ kind: "error", text: e instanceof Error ? e.message : "Nie udało się wysłać" });
    }
  }

  return (
    <div className="animate-fade-up">
      <h2 className="font-display text-4xl">📣 Wysyłanie wiadomości</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Złóż wiadomość z embedem, sprawdź podgląd i wyślij od razu na wybrany kanał – jako bot albo
        przez webhook z własną nazwą i avatarem. Szkic zapisuje się w tej przeglądarce.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_minmax(0,540px)]">
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-5">
            <span className={label}>Kanał</span>
            <select
              className="editor-select"
              value={m.channelId}
              onChange={(e) => set({ channelId: e.target.value })}
            >
              <option value="">— wybierz kanał —</option>
              {textChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  # {c.name}
                </option>
              ))}
            </select>

            <span className={`${label} mt-4`}>Wyślij jako</span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["bot", "Bot", Bot, "Wiadomość od bota"],
                  ["webhook", "Webhook", Webhook, "Własna nazwa i avatar"],
                ] as const
              ).map(([id, name, Icon, hint]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={m.mode === id}
                  onClick={() => set({ mode: id })}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${m.mode === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
                >
                  <Icon className="size-5" />
                  <span>
                    <span className="block text-sm font-bold">{name}</span>
                    <span className="block text-xs opacity-80">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
            {m.mode === "webhook" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={label}>Nazwa nadawcy</span>
                  <Input
                    maxLength={80}
                    value={m.webhookName}
                    placeholder="Emergency Hamburg"
                    onChange={(e) => set({ webhookName: e.target.value })}
                  />
                </label>
                <div>
                  <span className={label}>Avatar (https)</span>
                  <ImageField
                    guildId={guildId}
                    value={m.webhookAvatar}
                    onChange={(v) => set({ webhookAvatar: v })}
                    placeholder="https://…"
                  />
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Bot sam utworzy webhook „EH Bot” na tym kanale (wymaga uprawnienia „Zarządzanie
                  webhookami”).
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-5">
            <span className={label}>Treść wiadomości (nad embedem)</span>
            <Textarea
              maxLength={2000}
              rows={3}
              value={m.content}
              placeholder="Zwykły tekst. Obsługuje **pogrubienie**, *kursywę*, `kod`…"
              onChange={(e) => set({ content: e.target.value })}
            />
            <label className="mt-3 flex items-center justify-between rounded-md border px-3 py-2 text-sm font-semibold">
              <span>Pinguj @everyone</span>
              <Switch
                aria-label="Pinguj everyone"
                checked={m.pingEveryone}
                onCheckedChange={(v) => set({ pingEveryone: v })}
              />
            </label>
          </div>

          <RolePicker
            field={{
              key: "ping",
              label: "Pinguj rangi",
              desc: "Wybrane rangi zostaną oznaczone nad wiadomością",
              multi: true,
            }}
            roles={roles}
            selected={m.pingRoleIds}
            onToggle={(id) =>
              set({
                pingRoleIds: m.pingRoleIds.includes(id)
                  ? m.pingRoleIds.filter((x) => x !== id)
                  : [...m.pingRoleIds, id].slice(0, 10),
              })
            }
          />

          {m.embeds.map((e, i) => (
            <div key={i} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Embed {i + 1}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ embeds: m.embeds.filter((_, k) => k !== i) })}
                >
                  <Trash2 className="size-4" />
                  Usuń
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className={label}>Tytuł</span>
                  <Input
                    maxLength={256}
                    value={e.title}
                    onChange={(ev) => setEmbed(i, { title: ev.target.value })}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className={label}>Opis</span>
                  <Textarea
                    maxLength={4000}
                    rows={5}
                    value={e.description}
                    onChange={(ev) => setEmbed(i, { description: ev.target.value })}
                  />
                </label>
                <label>
                  <span className={label}>Kolor</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="color"
                      value={e.color}
                      onChange={(ev) => setEmbed(i, { color: ev.target.value })}
                      className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                    />
                    <Input
                      value={e.color}
                      maxLength={7}
                      onChange={(ev) => setEmbed(i, { color: ev.target.value })}
                    />
                  </span>
                </label>
                <label>
                  <span className={label}>Link tytułu (https)</span>
                  <Input
                    value={e.url}
                    placeholder="https://…"
                    onChange={(ev) => setEmbed(i, { url: ev.target.value })}
                  />
                </label>
                <div>
                  <span className={label}>Miniatura</span>
                  <ImageField
                    guildId={guildId}
                    value={e.thumbnail}
                    onChange={(v) => setEmbed(i, { thumbnail: v })}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <span className={label}>Duży obrazek</span>
                  <ImageField
                    guildId={guildId}
                    value={e.image}
                    onChange={(v) => setEmbed(i, { image: v })}
                    placeholder="https://…"
                  />
                </div>
                <label>
                  <span className={label}>Autor</span>
                  <Input
                    maxLength={256}
                    value={e.author}
                    onChange={(ev) => setEmbed(i, { author: ev.target.value })}
                  />
                </label>
                <div>
                  <span className={label}>Ikona autora</span>
                  <ImageField
                    guildId={guildId}
                    value={e.authorIcon}
                    onChange={(v) => setEmbed(i, { authorIcon: v })}
                    placeholder="https://…"
                  />
                </div>
                <label>
                  <span className={label}>Stopka</span>
                  <Input
                    maxLength={2048}
                    value={e.footer}
                    onChange={(ev) => setEmbed(i, { footer: ev.target.value })}
                  />
                </label>
                <div>
                  <span className={label}>Ikona stopki</span>
                  <ImageField
                    guildId={guildId}
                    value={e.footerIcon}
                    onChange={(v) => setEmbed(i, { footerIcon: v })}
                    placeholder="https://…"
                  />
                </div>
                <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm font-semibold sm:col-span-2">
                  <span>Pokaż znacznik czasu</span>
                  <Switch
                    aria-label="Znacznik czasu"
                    checked={e.timestamp}
                    onCheckedChange={(v) => setEmbed(i, { timestamp: v })}
                  />
                </label>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className={label}>Pola ({e.fields.length}/10)</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={e.fields.length >= 10}
                    onClick={() =>
                      setEmbed(i, { fields: [...e.fields, { name: "", value: "", inline: true }] })
                    }
                  >
                    <Plus className="size-4" />
                    Dodaj pole
                  </Button>
                </div>
                <div className="mt-2 space-y-2">
                  {e.fields.map((f, k) => (
                    <div
                      key={k}
                      className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
                    >
                      <Input
                        maxLength={256}
                        placeholder="Nazwa pola"
                        value={f.name}
                        onChange={(ev) =>
                          setEmbed(i, {
                            fields: e.fields.map((x, y) =>
                              y === k ? { ...x, name: ev.target.value } : x,
                            ),
                          })
                        }
                      />
                      <Input
                        maxLength={1024}
                        placeholder="Wartość"
                        value={f.value}
                        onChange={(ev) =>
                          setEmbed(i, {
                            fields: e.fields.map((x, y) =>
                              y === k ? { ...x, value: ev.target.value } : x,
                            ),
                          })
                        }
                      />
                      <label className="flex items-center gap-2 text-xs font-semibold">
                        <Switch
                          aria-label="W jednej linii"
                          checked={f.inline}
                          onCheckedChange={(v) =>
                            setEmbed(i, {
                              fields: e.fields.map((x, y) => (y === k ? { ...x, inline: v } : x)),
                            })
                          }
                        />
                        W linii
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Usuń pole"
                        onClick={() => setEmbed(i, { fields: e.fields.filter((_, y) => y !== k) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={m.embeds.length >= 3}
              onClick={() => set({ embeds: [...m.embeds, emptyComposerEmbed()] })}
            >
              <Plus className="size-4" />
              Dodaj embed ({m.embeds.length}/3)
            </Button>
            <span
              className={`text-xs ${chars > 6000 ? "font-bold text-destructive" : "text-muted-foreground"}`}
            >
              {chars}/6000 znaków w embedach
            </span>
          </div>
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <p className={label}>Podgląd</p>
          <Preview
            m={m}
            roles={roles}
            channelName={textChannels.find((c) => c.id === m.channelId)?.name ?? ""}
          />
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={state.kind === "sending"}
            className="mt-4 w-full"
            size="lg"
          >
            <Send className="size-4" />
            {state.kind === "sending" ? "Wysyłanie…" : "Wyślij wiadomość"}
          </Button>
          {state.kind === "ok" && (
            <p className="mt-3 rounded-lg border border-emerald-500/50 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              ✅ Wysłano!{" "}
              <a href={state.text} target="_blank" rel="noreferrer" className="underline">
                Otwórz na Discordzie
              </a>
            </p>
          )}
          {state.kind === "error" && (
            <p className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              ❌ {state.text}
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setM(emptyComposer());
              setState({ kind: "idle" });
            }}
          >
            Wyczyść formularz
          </Button>
        </div>
      </div>
    </div>
  );
}
