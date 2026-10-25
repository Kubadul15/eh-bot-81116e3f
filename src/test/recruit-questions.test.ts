import { describe, expect, it } from "vitest";
import { defaultContent, readContent, recruitmentSchema } from "@/lib/content-config";
import { FREE_LIMITS, PREMIUM_LIMITS, limitsFor } from "@/lib/premium";

const q = (i: number, label = `Pytanie ${i}`) => ({
  id: `q${i}`,
  label,
  style: "long" as const,
  required: true,
  placeholder: "",
});
const rec = (n: number, label?: string) => ({
  open: true,
  positions: [],
  questions: Array.from({ length: n }, (_, i) => q(i, label)),
});

describe("pytania rekrutacji: do 25, treść do 200 znaków", () => {
  it("schemat przyjmuje 25 pytań, ale nie 26", () => {
    expect(recruitmentSchema.safeParse(rec(25)).success).toBe(true);
    expect(recruitmentSchema.safeParse(rec(26)).success).toBe(false);
  });
  it("treść pytania może mieć 200 znaków (dawniej 45), nie więcej", () => {
    expect(recruitmentSchema.safeParse(rec(1, "x".repeat(200))).success).toBe(true);
    expect(recruitmentSchema.safeParse(rec(1, "x".repeat(201))).success).toBe(false);
    expect(recruitmentSchema.safeParse(rec(1, "")).success).toBe(false);
  });
  it("limity planów: Free 5, Premium 25", () => {
    expect(FREE_LIMITS.recruitQuestions).toBe(5);
    expect(PREMIUM_LIMITS.recruitQuestions).toBe(25);
    expect(limitsFor({}).recruitQuestions).toBe(5);
    const premium = {
      premium: { since: "", until: null, by: "", source: "admin" as const, note: "" },
    };
    expect(limitsFor(premium).recruitQuestions).toBe(25);
  });
  it("zapisana treść z długimi pytaniami się wczytuje (nie wraca do domyślnej)", () => {
    const content = { recruitment: rec(25, "y".repeat(180)), embeds: {} };
    const read = readContent(content);
    expect(read.recruitment.questions).toHaveLength(25);
    expect(read.recruitment.questions[0]?.label).toHaveLength(180);
    expect(defaultContent().recruitment.questions).toHaveLength(0);
  });
});
