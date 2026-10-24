import { describe, expect, it } from "vitest";
import { md } from "@/components/message-composer";
import { composerSchema, emptyComposer, emptyComposerEmbed } from "@/lib/message-config";

const valid = () => ({ ...emptyComposer(), channelId: "123456789012345678", content: "Cześć" });

describe("podgląd markdown", () => {
  it("escapuje HTML, więc wstrzyknięty kod się nie wykona", () => {
    expect(md("<img src=x onerror=alert(1)>")).not.toContain("<img");
    expect(md("<script>alert(1)</script>")).toContain("&lt;script&gt;");
  });
  it("obsługuje pogrubienie, kod i nowe linie", () => {
    expect(md("**a**")).toBe("<strong>a</strong>");
    expect(md("`x`")).toContain("<code");
    expect(md("a\nb")).toBe("a<br/>b");
  });
});

describe("walidacja wiadomości", () => {
  it("przyjmuje poprawną wiadomość", () => {
    expect(composerSchema.safeParse(valid()).success).toBe(true);
  });
  it("odrzuca pustą wiadomość", () => {
    const r = composerSchema.safeParse({ ...valid(), content: "", embeds: [emptyComposerEmbed()] });
    expect(r.success).toBe(false);
  });
  it("odrzuca brak kanału", () => {
    expect(composerSchema.safeParse({ ...valid(), channelId: "" }).success).toBe(false);
  });
  it("odrzuca obrazki spoza https", () => {
    const e = { ...emptyComposerEmbed(), description: "x", image: "http://example.com/a.png" };
    expect(composerSchema.safeParse({ ...valid(), embeds: [e] }).success).toBe(false);
  });
  it("odrzuca embedy powyżej 6000 znaków łącznie", () => {
    const long = { ...emptyComposerEmbed(), description: "a".repeat(4000) };
    const r = composerSchema.safeParse({ ...valid(), embeds: [long, long] });
    expect(r.success).toBe(false);
  });
  it("odrzuca więcej niż 10 pól i więcej niż 3 embedy", () => {
    const f = { name: "a", value: "b", inline: true };
    expect(
      composerSchema.safeParse({
        ...valid(),
        embeds: [{ ...emptyComposerEmbed(), fields: Array(11).fill(f) }],
      }).success,
    ).toBe(false);
    expect(
      composerSchema.safeParse({ ...valid(), embeds: Array(4).fill(emptyComposerEmbed()) }).success,
    ).toBe(false);
  });
});
