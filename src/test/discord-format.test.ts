import { describe, expect, it } from "vitest";
import {
  discordAvatarUrl,
  discordIconUrl,
  discordMd,
  formatDiscordTime,
  type MdCtx,
} from "@/lib/discord-format";

const ctx: MdCtx = {
  roles: new Map([["111111111111111111", { name: "Administracja", color: 0xe74c3c }]]),
  channels: new Map([["222222222222222222", "ogloszenia"]]),
};

describe("podgląd Discorda: markdown", () => {
  it("nie wykonuje wstrzykniętego HTML ani skryptów", () => {
    for (const bad of [
      "<img src=x onerror=alert(1)>",
      "<script>alert(1)</script>",
      "<svg onload=alert(1)>",
    ]) {
      const out = discordMd(bad, ctx);
      expect(out).not.toMatch(/<(img|script|svg)\b/i);
      expect(out).toContain("&lt;");
    }
  });
  it("nie tworzy aktywnych linków z javascript: ani http", () => {
    expect(discordMd("[x](javascript:alert(1))", ctx)).not.toContain("dc-link");
    expect(discordMd("[x](http://example.com)", ctx)).not.toContain("dc-link");
    expect(discordMd("[x](https://example.com)", ctx)).toContain("dc-link");
    expect(discordMd("[x](https://example.com)", ctx)).not.toContain("href");
  });
  it("formatuje pogrubienie, kursywę, przekreślenie, spoiler i nowe linie", () => {
    expect(discordMd("**a**")).toBe("<strong>a</strong>");
    expect(discordMd("~~a~~")).toBe("<s>a</s>");
    expect(discordMd("||tajne||")).toContain("dc-spoiler");
    expect(discordMd("a\nb")).toBe("a<br/>b");
  });
  it("kod nie jest dalej formatowany", () => {
    const out = discordMd("`**nie**` i ```\n*też nie*\n```");
    expect(out).toContain("<code");
    expect(out).toContain("**nie**");
    expect(out).toContain("*też nie*");
    expect(out).not.toContain("<strong>");
    expect(out).not.toContain("<em>");
  });
  it("wzmianka roli ma kolor i nazwę roli z serwera, nieznana pokazuje się jako usunięta", () => {
    const out = discordMd("<@&111111111111111111> <@&333333333333333333>", ctx);
    expect(out).toContain("@Administracja");
    expect(out).toContain("#e74c3c");
    expect(out).toContain("@usunięta-ranga");
  });
  it("wzmianka kanału pokazuje jego nazwę", () => {
    expect(discordMd("<#222222222222222222>", ctx)).toContain("#ogloszenia");
  });
  it("własne emoji i znaczniki czasu są obsłużone", () => {
    expect(discordMd("<:eh:123456789012345678>")).toContain(
      "cdn.discordapp.com/emojis/123456789012345678.png",
    );
    expect(discordMd("<a:tan:123456789012345678>")).toContain(".gif");
    expect(discordMd("<t:1700000000:t>")).toContain("dc-time");
  });
  it("nagłówki i cytaty", () => {
    expect(discordMd("# Tytuł")).toContain('class="dc-h1"');
    expect(discordMd("### Mały")).toContain('class="dc-h3"');
    expect(discordMd("> cytat")).toContain("dc-quote");
  });
  it("nazwa roli z HTML jest escapowana", () => {
    const evil: MdCtx = {
      roles: new Map([["111111111111111111", { name: "<b>x</b>", color: 0 }]]),
    };
    expect(discordMd("<@&111111111111111111>", evil)).not.toContain("<b>");
  });
});

describe("avatary i czas", () => {
  it("adres avatara: własny albo domyślny według id", () => {
    expect(discordAvatarUrl("123456789012345678", "abc")).toBe(
      "https://cdn.discordapp.com/avatars/123456789012345678/abc.png?size=128",
    );
    expect(discordAvatarUrl("123456789012345678", "a_abc")).toContain(".gif");
    expect(discordAvatarUrl("123456789012345678", null)).toMatch(/embed\/avatars\/[0-5]\.png$/);
    expect(discordAvatarUrl("nie-liczba", null)).toBe(
      "https://cdn.discordapp.com/embed/avatars/0.png",
    );
  });
  it("ikona serwera tylko gdy jest", () => {
    expect(discordIconUrl("1", null)).toBeNull();
    expect(discordIconUrl("1", "h")).toBe("https://cdn.discordapp.com/icons/1/h.png?size=128");
  });
  it("czas względny po polsku", () => {
    const now = 1_700_000_000_000;
    expect(formatDiscordTime(1_700_000_300, "R", now)).toBe("za 5 minut");
    expect(formatDiscordTime(1_699_996_400, "R", now)).toBe("1 godzin temu");
    expect(formatDiscordTime(1_700_000_000, "t", now)).toMatch(/^\d{2}:\d{2}$/);
  });
});
