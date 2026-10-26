import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { DiscordWindow } from "@/components/discord-window";
import { I18nProvider } from "@/lib/i18n-react";
import { emptyComposer, emptyComposerEmbed } from "@/lib/message-config";

const roles = [{ id: "111111111111111111", name: "Administracja", color: 0xe74c3c }];
const channels = [
  { id: "222222222222222222", name: "ogloszenia", type: 0 },
  { id: "333333333333333333", name: "rozmowy", type: 0 },
  { id: "444444444444444444", name: "glosowy", type: 2 },
];
const view = {
  bot: { id: "9", name: "Bot Hamburg", avatar: "https://cdn.discordapp.com/embed/avatars/1.png" },
  guild: { id: "1", name: "Emergency Hamburg RP", icon: null },
};
// React SSR wstawia komentarze <!-- --> między fragmentami tekstu – do porównań je usuwamy
const render = (over: Partial<Parameters<typeof DiscordWindow>[0]> = {}) =>
  renderToString(
    <I18nProvider lang="pl">
      <DiscordWindow
        m={{
          ...emptyComposer(),
          channelId: "222222222222222222",
          content: "Cześć **wszystkim**",
          pingRoleIds: ["111111111111111111"],
          embeds: [
            { ...emptyComposerEmbed(), title: "Nabór", description: "Opis", color: "#ff0000" },
          ],
        }}
        roles={roles}
        channels={channels}
        view={view}
        loading={false}
        error=""
        sending={false}
        onContent={() => undefined}
        onSend={() => undefined}
        {...over}
      />
    </I18nProvider>,
  ).replace(/<!-- -->/g, "");

describe("okno podglądu Discorda", () => {
  it("pokazuje prawdziwą nazwę i avatar bota, serwer, kanał i wiadomość", () => {
    const html = render();
    expect(html).toContain("Bot Hamburg");
    expect(html).toContain("avatars/1.png");
    expect(html).toContain("Emergency Hamburg RP");
    expect(html).toContain("Witaj na #ogloszenia!");
    expect(html).toContain("<strong>wszystkim</strong>");
    expect(html).toContain("Nabór");
    expect(html).toContain("✓ BOT");
  });
  it("wzmianka rangi ma jej kolor i nazwę", () => {
    const html = render();
    expect(html).toContain("@Administracja");
    expect(html).toContain("#e74c3c");
  });
  it("lista kanałów zawiera tylko tekstowe", () => {
    const html = render();
    expect(html).toContain("rozmowy");
    expect(html).not.toContain("glosowy");
  });
  it("tryb webhook pokazuje własną nazwę zamiast bota", () => {
    const html = render({
      m: {
        ...emptyComposer(),
        channelId: "222222222222222222",
        mode: "webhook",
        webhookName: "Ogłoszenia EH",
        content: "x",
      },
    });
    expect(html).toContain("Ogłoszenia EH");
    expect(html).toContain("APLIKACJA");
    expect(html).not.toContain("Bot Hamburg");
  });
  it("bez danych bota nadal się renderuje (awaryjnie)", () => {
    expect(() => render({ view: undefined, loading: true })).not.toThrow();
  });
  it("na pasku wiadomości jest pole z nazwą kanału i przycisk wysyłania", () => {
    const html = render();
    expect(html).toContain("Napisz wiadomość na #ogloszenia");
    expect(html).toContain('aria-label="Wyślij wiadomość"');
  });
});
