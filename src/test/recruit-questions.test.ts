import { describe, expect, it } from "vitest";
import { defaultContent, questionsOf, readContent, recruitmentSchema } from "@/lib/content-config";
import { validateSubmission } from "@/lib/recruit-logic";
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

describe("pytania osobne dla każdego stanowiska (do 8 stanowisk po 25 pytań)", () => {
  const pos = (id: string, questions?: ReturnType<typeof q>[]) => ({
    id,
    label: `Stanowisko ${id}`,
    emoji: "",
    desc: "",
    roleId: "",
    open: true,
    ...(questions ? { questions } : {}),
  });
  const base = (positions: ReturnType<typeof pos>[], shared: ReturnType<typeof q>[] = []) => ({
    open: true,
    positions,
    questions: shared,
  });

  it("limity planów: Free 3 stanowiska, Premium 8; pytań 5 / 25 na stanowisko", () => {
    expect(FREE_LIMITS.recruitPositions).toBe(3);
    expect(PREMIUM_LIMITS.recruitPositions).toBe(8);
    expect(FREE_LIMITS.recruitQuestions).toBe(5);
    expect(PREMIUM_LIMITS.recruitQuestions).toBe(25);
  });

  it("schemat: każde stanowisko może mieć 25 pytań, ale nie 26 i bez powtórzonych id", () => {
    const qs = (n: number) => Array.from({ length: n }, (_, i) => q(i));
    const eight = Array.from({ length: 8 }, (_, i) => pos(`p${i}`, qs(25)));
    expect(recruitmentSchema.safeParse(base(eight)).success).toBe(true);
    expect(recruitmentSchema.safeParse(base([pos("a", qs(26))])).success).toBe(false);
    expect(recruitmentSchema.safeParse(base([pos("a", [q(1), q(1)])])).success).toBe(false);
  });

  it("to samo id pytania w różnych stanowiskach jest dozwolone (kopie)", () => {
    expect(recruitmentSchema.safeParse(base([pos("a", [q(1)]), pos("b", [q(1)])])).success).toBe(
      true,
    );
  });

  it("stare dane z jedną wspólną listą: każde stanowisko dostaje własną kopię, a lista wspólna się czyści", () => {
    const legacy = { recruitment: base([pos("a"), pos("b")], [q(1), q(2), q(3)]), embeds: {} };
    const c = readContent(legacy);
    expect(c.recruitment.questions).toHaveLength(0);
    expect(c.recruitment.positions.map((p) => p.questions?.length)).toEqual([3, 3]);
    // kopie są niezależne (zmiana w jednym stanowisku nie rusza drugiego)
    const a = c.recruitment.positions[0]?.questions?.[0];
    const b = c.recruitment.positions[1]?.questions?.[0];
    expect(a).not.toBe(b);
  });

  it("migracja nie rusza stanowisk, które już mają własne pytania", () => {
    const c = readContent({
      recruitment: base([pos("a", [q(9)]), pos("b")], [q(1), q(2)]),
      embeds: {},
    });
    expect(c.recruitment.positions[0]?.questions?.map((x) => x.id)).toEqual(["q9"]);
    expect(c.recruitment.positions[1]?.questions?.map((x) => x.id)).toEqual(["q1", "q2"]);
  });

  it("questionsOf: własne pytania stanowiska albo wspólna lista", () => {
    const c = {
      ...defaultContent(),
      recruitment: {
        open: true,
        positions: [pos("a", [q(1)]), pos("b")],
        questions: [q(7), q(8)],
      },
    };
    expect(questionsOf(c, "a").map((x) => x.id)).toEqual(["q1"]);
    expect(questionsOf(c, "b").map((x) => x.id)).toEqual(["q7", "q8"]);
    expect(questionsOf(c, "nie-ma").map((x) => x.id)).toEqual(["q7", "q8"]);
  });

  it("walidacja podania sprawdza pytania WYBRANEGO stanowiska", () => {
    const content = {
      ...defaultContent(),
      recruitment: {
        open: true,
        positions: [
          pos("mod", [{ ...q(1, "Pytanie moderatora"), required: true }]),
          pos("helper", [
            { ...q(2, "Pytanie helpera"), required: true },
            q(3, "Drugie pytanie helpera"),
          ]),
        ],
        questions: [],
      },
      recruitSite: { ...defaultContent().recruitSite, minChars: 5 },
    };
    const input = {
      positionId: "mod",
      discordNick: "jan_k",
      discordId: "",
      robloxNick: "JanK_1",
      age: 16,
      agree: true,
      tabSwitches: 0,
      answers: { q1: "Odpowiedź moderatora", q2: "To pytanie jest z innego stanowiska" },
    };
    const mod = validateSubmission(content, input);
    expect(mod.ok).toBe(true);
    if (mod.ok) expect(mod.data.answers.map((a) => a.id)).toEqual(["q1"]);
    // helper wymaga q2 i q3 – q1 z innego stanowiska nie liczy się
    const helper = validateSubmission(content, {
      ...input,
      positionId: "helper",
      answers: { q1: "x".repeat(20) },
    });
    expect(helper.ok).toBe(false);
    if (!helper.ok) expect(helper.errors.join(" ")).toContain("Pytanie helpera");
    const ok = validateSubmission(content, {
      ...input,
      positionId: "helper",
      answers: { q2: "Odpowiedź helpera", q3: "Druga odpowiedź" },
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data.answers.map((a) => a.id)).toEqual(["q2", "q3"]);
  });

  it("stanowisko bez własnych pytań (stare dane) używa wspólnej listy", () => {
    const content = {
      ...defaultContent(),
      recruitment: {
        open: true,
        positions: [pos("a")],
        questions: [{ ...q(5, "Wspólne"), required: true }],
      },
      recruitSite: { ...defaultContent().recruitSite, minChars: 3 },
    };
    const r = validateSubmission(content, {
      positionId: "a",
      discordNick: "jan_k",
      discordId: "",
      robloxNick: "JanK_1",
      age: 16,
      agree: true,
      tabSwitches: 0,
      answers: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("Wspólne");
  });
});
