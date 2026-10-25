// Formatowanie tekstu jak na Discordzie (markdown, wzmianki, emoji, znaczniki czasu) do podglądu wiadomości.
// Tekst jest najpierw escapowany, a w HTML trafiają tylko nasze znaczniki, więc wynik jest bezpieczny dla dangerouslySetInnerHTML.
export type MdRole = { name: string; color: number };
export type MdCtx = { roles?: Map<string, MdRole>; channels?: Map<string, string> };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hex = (n: number) => `#${(n >>> 0).toString(16).padStart(6, "0")}`;

/** Adres avatara użytkownika/bota (albo domyślnego, gdy brak własnego). */
export function discordAvatarUrl(id: string, hash: string | null | undefined, size = 128): string {
  if (hash)
    return `https://cdn.discordapp.com/avatars/${id}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=${size}`;
  let idx = 0;
  try {
    idx = Number((BigInt(id) >> 22n) % 6n);
  } catch {
    /* złe id → pierwszy domyślny avatar */
  }
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}
export const discordIconUrl = (
  id: string,
  hash: string | null | undefined,
  size = 128,
): string | null =>
  hash ? `https://cdn.discordapp.com/icons/${id}/${hash}.png?size=${size}` : null;

const DAY_NAMES = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
/** Znacznik czasu <t:UNIX:styl> jak na Discordzie (w uproszczeniu, po polsku). */
export function formatDiscordTime(unix: number, style = "f", now = Date.now()): string {
  const d = new Date(unix * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  switch (style) {
    case "t":
      return time;
    case "T":
      return `${time}:${p(d.getSeconds())}`;
    case "d":
      return date;
    case "D":
      return `${d.getDate()} ${d.toLocaleString("pl-PL", { month: "long" })} ${d.getFullYear()}`;
    case "F":
      return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${d.toLocaleString("pl-PL", { month: "long" })} ${d.getFullYear()} ${time}`;
    case "R": {
      const diff = Math.round((d.getTime() - now) / 1000),
        abs = Math.abs(diff);
      const unit =
        abs < 60
          ? [abs, "sekund"]
          : abs < 3600
            ? [Math.round(abs / 60), "minut"]
            : abs < 86400
              ? [Math.round(abs / 3600), "godzin"]
              : [Math.round(abs / 86400), "dni"];
      return diff >= 0 ? `za ${unit[0]} ${unit[1]}` : `${unit[0]} ${unit[1]} temu`;
    }
    default:
      return `${date} ${time}`;
  }
}

/** Markdown Discorda → bezpieczny HTML (wzmianki ról/kanałów, emoji, nagłówki, cytaty, spoilery, kod). */
export function discordMd(src: string, ctx: MdCtx = {}, now = Date.now()): string {
  const stash: string[] = [];
  const keep = (html: string) => `\u0000${stash.push(html) - 1}\u0000`;
  let t = esc(src);

  // kod nie jest dalej formatowany
  t = t.replace(/```(?:[a-z]+\n)?([\s\S]*?)```/g, (_, c: string) =>
    keep(`<pre class="dc-pre">${c.replace(/^\n|\n$/g, "")}</pre>`),
  );
  t = t.replace(/`([^`\n]+)`/g, (_, c: string) => keep(`<code class="dc-code">${c}</code>`));

  // wzmianki i emoji (po escapowaniu: < > są zakodowane)
  t = t.replace(/&lt;@&amp;(\d{17,20})&gt;/g, (_, id: string) => {
    const r = ctx.roles?.get(id);
    const color = r && r.color ? hex(r.color) : "#c9cdfb";
    return keep(
      `<span class="dc-mention" style="color:${color};background:${color}26">@${esc(r?.name ?? "usunięta-ranga")}</span>`,
    );
  });
  t = t.replace(/&lt;@!?(\d{17,20})&gt;/g, () =>
    keep(`<span class="dc-mention">@użytkownik</span>`),
  );
  t = t.replace(/&lt;#(\d{17,20})&gt;/g, (_, id: string) =>
    keep(`<span class="dc-mention">#${esc(ctx.channels?.get(id) ?? "kanał")}</span>`),
  );
  t = t.replace(/&lt;(a?):(\w{2,32}):(\d{17,20})&gt;/g, (_, a: string, name: string, id: string) =>
    keep(
      `<img class="dc-emoji" alt=":${name}:" src="https://cdn.discordapp.com/emojis/${id}.${a ? "gif" : "png"}?size=48"/>`,
    ),
  );
  t = t.replace(/&lt;t:(\d{1,12})(?::([tTdDfFR]))?&gt;/g, (_, u: string, s?: string) =>
    keep(`<span class="dc-time">${esc(formatDiscordTime(Number(u), s ?? "f", now))}</span>`),
  );
  t = t.replace(/@(everyone|here)\b/g, (_, w: string) =>
    keep(`<span class="dc-mention">@${w}</span>`),
  );

  // nagłówki i cytaty (na początku linii)
  t = t.replace(/^(#{1,3}) (.+)$/gm, (_, h: string, x: string) =>
    keep(`<div class="dc-h${h.length}">${x}</div>`),
  );
  t = t.replace(/^&gt; (.+)$/gm, (_, x: string) => keep(`<div class="dc-quote">${x}</div>`));

  // formatowanie w tekście
  t = t
    .replace(/\|\|([^|]+)\|\|/g, '<span class="dc-spoiler">$1</span>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^\w_])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<span class="dc-link">$1</span>')
    .replace(/(^|\s)(https:\/\/[^\s<]+)/g, '$1<span class="dc-link">$2</span>')
    .replace(/\n/g, "<br/>");

  return t.replace(/\u0000(\d+)\u0000/g, (_, n: string) => stash[Number(n)] ?? "");
}
