import { describe, expect, it } from "vitest";
import { contentSchema, defaultContent, emptyEmbed } from "@/lib/content-config";

describe("Dashboard customization", () => {
  it("keeps recruitment globally closed independently from an open position", () => {
    const config = defaultContent();
    config.recruitment.positions.push({ id: "police", label: "Policja", emoji: "", desc: "", roleId: "", open: true });
    const parsed = contentSchema.parse(config);
    expect(parsed.recruitment.open).toBe(false);
    expect(parsed.recruitment.positions[0].open).toBe(true);
  });
  it("retains edited recruitment questions and their order", () => {
    const config = defaultContent();
    config.recruitment.questions = [{ id: "age", label: "Ile masz lat?", style: "short", required: true, placeholder: "Wiek" }, { id: "why", label: "Dlaczego chcesz dołączyć?", style: "long", required: false, placeholder: "" }];
    expect(contentSchema.parse(config).recruitment.questions.map(q => [q.id, q.style, q.required])).toEqual([["age", "short", true], ["why", "long", false]]);
  });
  it("retains an individual image for each embed", () => {
    const config = defaultContent(); config.embeds.ban = { ...emptyEmbed(), image: "https://example.org/ban.png" }; config.embeds.rekrutacja = { ...emptyEmbed(), image: "https://example.org/recruit.png" };
    const result = contentSchema.parse(config);
    expect(result.embeds.ban.image).toBe("https://example.org/ban.png"); expect(result.embeds.rekrutacja.image).toBe("https://example.org/recruit.png");
  });
  it("rejects unsafe image addresses", () => {
    const config = defaultContent(); config.embeds.ban = { ...emptyEmbed(), image: "javascript:alert(1)" };
    expect(contentSchema.safeParse(config).success).toBe(false);
  });
});