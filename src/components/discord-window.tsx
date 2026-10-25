import { useEffect, useMemo, useState } from "react";
import { Hash, Monitor, Moon, Send, Smartphone, Sun } from "lucide-react";
import { discordMd, type MdCtx } from "@/lib/discord-format";
import type { BotView } from "@/lib/message.functions";
import type { ComposerEmbed, ComposerMessage } from "@/lib/message-config";
import type { DChannel, DRole } from "@/components/config-ui";

// „Okno Discorda” z podglądem wiadomości dokładnie tak, jak zobaczy ją gracz: prawdziwy avatar i nazwa bota z tego serwera, ikona i kanały serwera,
// kolory ról we wzmiankach, jasny/ciemny motyw i wersja na telefon. Pasek wiadomości na dole działa jak prawdziwy – wpisujesz tekst i wysyłasz.
const PALETTE = {
  dark: {
    rail: "#1e1f22",
    side: "#2b2d31",
    chat: "#313338",
    text: "#dbdee1",
    head: "#f2f3f5",
    muted: "#949ba4",
    input: "#383a40",
    embed: "#2b2d31",
    line: "rgba(0,0,0,.25)",
    hover: "#35373c",
  },
  light: {
    rail: "#e3e5e8",
    side: "#f2f3f5",
    chat: "#ffffff",
    text: "#2e3338",
    head: "#060607",
    muted: "#5c5e66",
    input: "#ebedef",
    embed: "#f2f3f5",
    line: "rgba(0,0,0,.08)",
    hover: "#e3e5e8",
  },
};
type Theme = keyof typeof PALETTE;
type P = (typeof PALETTE)[Theme];

const nowLabel = () =>
  `Dzisiaj o ${new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;

function Embed({ e, p, ctx, when }: { e: ComposerEmbed; p: P; ctx: MdCtx; when: string }) {
  const empty =
    !e.title &&
    !e.description &&
    !e.image &&
    !e.author &&
    !e.fields.length &&
    !e.footer &&
    !e.thumbnail;
  if (empty) return null;
  const html = (s: string) => ({ __html: discordMd(s, ctx) });
  return (
    <div
      className="mt-1 max-w-[520px] overflow-hidden rounded-[4px]"
      style={{ background: p.embed, borderLeft: `4px solid ${e.color}`, color: p.text }}
    >
      <div className="flex gap-3 p-3">
        <div className="min-w-0 flex-1">
          {e.author && (
            <div
              className="mb-1 flex items-center gap-2 text-sm font-semibold"
              style={{ color: p.head }}
            >
              {e.authorIcon && (
                <img src={e.authorIcon} alt="" className="size-6 rounded-full object-cover" />
              )}
              {e.author}
            </div>
          )}
          {e.title && (
            <div
              className="mb-1 break-words text-base font-semibold"
              style={{ color: e.url ? "#00a8fc" : p.head }}
            >
              {e.title}
            </div>
          )}
          {e.description && (
            <div
              className="dc-body break-words text-sm"
              dangerouslySetInnerHTML={html(e.description)}
            />
          )}
          {e.fields.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
              {e.fields.map((f, i) => (
                <div key={i} className={f.inline ? "col-span-1" : "col-span-3"}>
                  <div
                    className="dc-body text-sm font-semibold"
                    style={{ color: p.head }}
                    dangerouslySetInnerHTML={html(f.name)}
                  />
                  <div className="dc-body text-sm" dangerouslySetInnerHTML={html(f.value)} />
                </div>
              ))}
            </div>
          )}
          {e.image && (
            <img src={e.image} alt="" className="mt-3 max-h-80 w-full rounded-[4px] object-cover" />
          )}
          {(e.footer || e.timestamp) && (
            <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: p.muted }}>
              {e.footerIcon && (
                <img src={e.footerIcon} alt="" className="size-5 rounded-full object-cover" />
              )}
              {[e.footer, e.timestamp ? when : ""].filter(Boolean).join(" • ")}
            </div>
          )}
        </div>
        {e.thumbnail && (
          <img
            src={e.thumbnail}
            alt=""
            className="size-20 shrink-0 self-start rounded-[4px] object-cover"
          />
        )}
      </div>
    </div>
  );
}

export function DiscordWindow({
  m,
  roles,
  channels,
  view,
  loading,
  error,
  sending,
  large = false,
  onContent,
  onSend,
}: {
  m: ComposerMessage;
  roles: DRole[];
  channels: DChannel[];
  view: BotView | undefined;
  loading: boolean;
  error: string;
  sending: boolean;
  /** widok na cały ekran: wyższe okno, szersza lista kanałów */
  large?: boolean;
  onContent: (v: string) => void;
  onSend: () => void;
}) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [when, setWhen] = useState("");
  useEffect(() => setWhen(nowLabel()), [m.content, m.embeds]);
  const p = PALETTE[theme];

  const ctx = useMemo<MdCtx>(
    () => ({
      roles: new Map(roles.map((r) => [r.id, { name: r.name, color: r.color }])),
      channels: new Map(channels.map((c) => [c.id, c.name])),
    }),
    [roles, channels],
  );
  const text = channels.filter((c) => c.type === 0 || c.type === 5);
  const current = text.find((c) => c.id === m.channelId);
  const chName = current?.name ?? "wybierz-kanal";
  const webhook = m.mode === "webhook";
  const name = webhook ? m.webhookName || "Emergency Hamburg" : (view?.bot.name ?? "Bot");
  const avatar = webhook ? m.webhookAvatar : view?.bot.avatar;
  const pings = m.pingRoleIds.map((id) => ({
    id,
    ...(ctx.roles?.get(id) ?? { name: "ranga", color: 0 }),
  }));
  const mobile = device === "mobile";

  const chat = (
    <div className="flex min-w-0 flex-1 flex-col" style={{ background: p.chat, color: p.text }}>
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5 text-[15px] font-semibold"
        style={{ borderColor: p.line, color: p.head }}
      >
        {mobile && <span className="mr-1 text-lg leading-none">‹</span>}
        <Hash className="size-5" style={{ color: p.muted }} />
        {chName}
      </div>

      <div
        className={`${large ? "min-h-[58vh]" : "min-h-64"} flex-1 overflow-y-auto px-4 pb-3 pt-6`}
      >
        <div className="mb-5">
          <div
            className="grid size-16 place-items-center rounded-full"
            style={{ background: p.input }}
          >
            <Hash className="size-9" style={{ color: p.head }} />
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: p.head }}>
            Witaj na #{chName}!
          </p>
          <p className="text-sm" style={{ color: p.muted }}>
            To jest początek kanału #{chName}.
          </p>
        </div>

        <div className="flex gap-3">
          {avatar ? (
            <img src={avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#5865f2] text-white">
              {loading ? "…" : "🤖"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="font-semibold" style={{ color: p.head }}>
                {name}
              </span>
              <span className="inline-flex items-center rounded-[3px] bg-[#5865f2] px-1 text-[10px] font-bold leading-4 text-white">
                {webhook ? "APLIKACJA" : "✓ BOT"}
              </span>
              <span className="text-xs" style={{ color: p.muted }}>
                {when || "Dzisiaj"}
              </span>
            </div>
            {(m.pingEveryone || pings.length > 0 || m.content) && (
              <div className="dc-body break-words text-[15px] leading-[1.4]">
                {m.pingEveryone && <span className="dc-mention mr-1">@everyone</span>}
                {pings.map((r) => {
                  const c = r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#c9cdfb";
                  return (
                    <span
                      key={r.id}
                      className="dc-mention mr-1"
                      style={{ color: c, background: `${c}26` }}
                    >
                      @{r.name}
                    </span>
                  );
                })}
                <span dangerouslySetInnerHTML={{ __html: discordMd(m.content, ctx) }} />
              </div>
            )}
            {m.embeds.map((e, i) => (
              <Embed key={i} e={e} p={p} ctx={ctx} when={when || "Dzisiaj"} />
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 rounded-lg px-3" style={{ background: p.input }}>
          <input
            aria-label={`Napisz wiadomość na #${chName}`}
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:opacity-60"
            style={{ color: p.text }}
            placeholder={`Napisz wiadomość na #${chName}`}
            maxLength={2000}
            value={m.content.includes("\n") ? m.content.split("\n")[0] : m.content}
            readOnly={m.content.includes("\n")}
            onChange={(e) => onContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <button
            type="button"
            aria-label="Wyślij wiadomość"
            title="Wyślij (Enter)"
            disabled={sending}
            onClick={onSend}
            className="grid size-8 place-items-center rounded-md bg-[#5865f2] text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Tak zobaczą to gracze{view ? ` na serwerze ${view.guild.name}` : ""}
        </span>
        <div className="flex gap-1">
          {(
            [
              ["desktop", Monitor, "Komputer"],
              ["mobile", Smartphone, "Telefon"],
            ] as const
          ).map(([id, Icon, title]) => (
            <button
              key={id}
              type="button"
              aria-pressed={device === id}
              title={title}
              onClick={() => setDevice(id)}
              className={`grid size-8 place-items-center rounded-md border text-sm ${device === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            >
              <Icon className="size-4" />
            </button>
          ))}
          <button
            type="button"
            title={theme === "dark" ? "Jasny motyw Discorda" : "Ciemny motyw Discorda"}
            aria-label="Przełącz motyw podglądu"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="grid size-8 place-items-center rounded-md border bg-card hover:bg-muted"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>

      <div
        className={`dc-window overflow-hidden rounded-xl border shadow-sm ${theme === "light" ? "dc-light" : ""} ${mobile ? "mx-auto max-w-[390px]" : ""}`}
        style={{ borderColor: p.line }}
      >
        <div className="flex">
          {!mobile && (
            <>
              <div
                className="flex w-14 shrink-0 flex-col items-center gap-2 py-3"
                style={{ background: p.rail }}
              >
                {view?.guild.icon ? (
                  <img src={view.guild.icon} alt="" className="size-10 rounded-2xl object-cover" />
                ) : (
                  <div className="grid size-10 place-items-center rounded-2xl bg-[#5865f2] text-sm font-bold text-white">
                    {(view?.guild.name ?? "S").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div
                className={`hidden shrink-0 flex-col sm:flex ${large ? "w-56" : "w-40"}`}
                style={{ background: p.side, color: p.muted }}
              >
                <div
                  className="truncate border-b px-3 py-3 text-sm font-semibold"
                  style={{ borderColor: p.line, color: p.head }}
                >
                  {view?.guild.name ?? (loading ? "Wczytywanie…" : "Serwer")}
                </div>
                <div className="space-y-0.5 p-2 text-sm">
                  {text.slice(0, 12).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-1.5 truncate rounded px-2 py-1"
                      style={
                        c.id === m.channelId ? { background: p.hover, color: p.head } : undefined
                      }
                    >
                      <Hash className="size-4 shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </div>
                  ))}
                  {text.length === 0 && <div className="px-2 py-1 text-xs">Brak kanałów</div>}
                </div>
              </div>
            </>
          )}
          {chat}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
