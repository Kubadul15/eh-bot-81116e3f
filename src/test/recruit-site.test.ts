import { describe, expect, it } from "vitest";
import {
  defaultContent,
  readContent,
  recruitSiteSchema,
  type ContentConfig,
} from "@/lib/content-config";
import {
  fingerprint,
  scoreApplication,
  validateSubmission,
  type SubmitInput,
} from "@/lib/recruit-logic";
import { hasFeature, publicPremium } from "@/lib/premium";

const content = (): ContentConfig => {
  const c = defaultContent();
  c.recruitment = {
    open: true,
    positions: [
      { id: "mod", label: "Moderator", emoji: "🛡️", desc: "", roleId: "", open: true },
      { id: "adm", label: "Admin", emoji: "", desc: "", roleId: "", open: false },
    ],
    questions: [
      {
        id: "why",
        label: "Dlaczego chcesz dołączyć?",
        style: "long",
        required: true,
        placeholder: "",
      },
      { id: "xp", label: "Doświadczenie", style: "short", required: false, placeholder: "" },
    ],
  };
  c.recruitSite = { ...c.recruitSite, enabled: true, minChars: 20 };
  return c;
};
const good = (over: Partial<SubmitInput> = {}): SubmitInput => ({
  positionId: "mod",
  discordNick: "jan_kowalski",
  discordId: "",
  robloxNick: "JanK_2008",
  age: 16,
  answers: { why: "Chcę pomagać społeczności i dbać o porządek na serwerze." },
  agree: true,
  tabSwitches: 2,
  ...over,
});

describe("zgodność wsteczna konfiguracji", () => {
  it("stare dane bez recruitSite dostają domyślną, wyłączoną stronę", () => {
    const old = { recruitment: { open: true, positions: [], questions: [] }, embeds: {} };
    const c = readContent(old);
    expect(c.recruitSite.enabled).toBe(false);
    expect(c.recruitSite.minChars).toBe(45);
    expect(c.recruitSite.cooldownHours).toBe(24);
  });
  it("schemat odrzuca złe kolory, obce linki zaproszeń i zbyt długie FAQ", () => {
    const base = defaultContent().recruitSite;
    expect(recruitSiteSchema.safeParse({ ...base, accent: "red" }).success).toBe(false);
    expect(
      recruitSiteSchema.safeParse({ ...base, discord: "https://evil.example/invite/abc" }).success,
    ).toBe(false);
    expect(
      recruitSiteSchema.safeParse({ ...base, discord: "https://discord.gg/abc123" }).success,
    ).toBe(true);
    expect(recruitSiteSchema.safeParse({ ...base, banner: "http://x/y.png" }).success).toBe(false);
    const faq = Array.from({ length: 9 }, (_, i) => ({ q: `q${i}`, a: "a" }));
    expect(recruitSiteSchema.safeParse({ ...base, faq }).success).toBe(false);
  });
});

describe("walidacja podania", () => {
  it("poprawne podanie przechodzi i jest oczyszczone", () => {
    const r = validateSubmission(content(), good({ discordNick: "  jan   kowalski " }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.discordNick).toBe("jan kowalski");
      expect(r.data.position).toEqual({ id: "mod", label: "Moderator" });
      expect(r.data.answers).toHaveLength(1);
      expect(r.data.discordId).toBeNull();
    }
  });
  it("rekrutacja zamknięta i zamknięte stanowisko są odrzucane", () => {
    const closed = content();
    closed.recruitment.open = false;
    expect(validateSubmission(closed, good())).toMatchObject({ ok: false });
    const r = validateSubmission(content(), good({ positionId: "adm" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("zamknięte");
    expect(validateSubmission(content(), good({ positionId: "nie-ma" })).ok).toBe(false);
  });
  it("wymusza minimalną długość, wymagane pola i dane osobowe", () => {
    const r = validateSubmission(
      content(),
      good({
        answers: { why: "za krótko" },
        robloxNick: "a!",
        age: 4,
        discordNick: "x",
        agree: false,
        discordId: "12",
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const text = r.errors.join("\n");
      for (const part of [
        "za krótka",
        "Roblox",
        "Wiek",
        "Nick Discord",
        "samodzielnie",
        "ID Discord",
      ])
        expect(text).toContain(part);
    }
    const missing = validateSubmission(content(), good({ answers: {} }));
    expect(missing.ok).toBe(false);
  });
  it("opcjonalne pytanie może być puste, ale jeśli jest, też musi spełniać minimum", () => {
    expect(
      validateSubmission(content(), good({ answers: { why: good().answers["why"]!, xp: "" } })).ok,
    ).toBe(true);
    expect(
      validateSubmission(
        content(),
        good({ answers: { why: good().answers["why"]!, xp: "krótkie" } }),
      ).ok,
    ).toBe(false);
  });
  it("odpowiedzi spoza konfiguracji są ignorowane, a licznik kart ograniczony", () => {
    const r = validateSubmission(
      content(),
      good({ tabSwitches: 99999, answers: { why: good().answers["why"]!, obce: "x".repeat(50) } }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.answers.map((a) => a.id)).toEqual(["why"]);
      expect(r.data.tabSwitches).toBe(999);
    }
  });
  it("za długa odpowiedź krótkiego pola jest odrzucana", () => {
    const r = validateSubmission(
      content(),
      good({ answers: { why: good().answers["why"]!, xp: "x".repeat(301) } }),
    );
    expect(r.ok).toBe(false);
  });
});

describe("ocena wstępna", () => {
  it("rzetelne odpowiedzi dostają wysoką ocenę bez uwag", () => {
    const a = [
      {
        q: "A",
        a: "Od dawna gram w Emergency Hamburg i chcę pomagać nowym graczom poznawać zasady serwera oraz dbać o kulturę.",
      },
      {
        q: "B",
        a: "Byłem moderatorem na dwóch innych serwerach, gdzie prowadziłem rekrutację i szkolenia dla nowej ekipy.",
      },
    ];
    const r = scoreApplication(a, 45);
    expect(r.score).toBeGreaterThan(70);
    expect(r.flags).toEqual([]);
  });
  it("spam, powtórki i linki obniżają ocenę i dają uwagi", () => {
    const r = scoreApplication(
      [
        { q: "A", a: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        { q: "B", a: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        { q: "C", a: "zobacz https://spam.example" },
      ],
      45,
    );
    expect(r.score).toBeLessThan(40);
    expect(r.flags).toEqual(
      expect.arrayContaining([
        "powtarzające się znaki",
        "identyczne odpowiedzi",
        "linki w odpowiedzi",
      ]),
    );
  });
  it("brak odpowiedzi to zero", () => {
    expect(scoreApplication([], 45)).toEqual({ score: 0, flags: ["brak odpowiedzi"] });
  });
});

describe("odcisk blokady", () => {
  it("jest stały, zależy od serwera i nie zawiera adresu IP", async () => {
    const a = await fingerprint("1.2.3.4", "100000000000000001", "s");
    expect(a).toBe(await fingerprint("1.2.3.4", "100000000000000001", "s"));
    expect(a).not.toBe(await fingerprint("1.2.3.4", "100000000000000002", "s"));
    expect(a).not.toBe(await fingerprint("1.2.3.5", "100000000000000001", "s"));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain("1.2.3.4");
  });
});

describe("dostęp do strony rekrutacyjnej (Premium)", () => {
  it("Free nie ma strony, Premium i funkcja nadana ręcznie – tak", () => {
    expect(hasFeature({}, "recruitSite")).toBe(false);
    expect(hasFeature({ features: ["recruitSite"] }, "recruitSite")).toBe(true);
    expect(
      hasFeature(
        { premium: { since: "", until: null, by: "", source: "admin", note: "" } },
        "recruitSite",
      ),
    ).toBe(true);
    expect(publicPremium({}).recruitSite).toBe(false);
    expect(publicPremium({ features: ["recruitSite"] }).recruitSite).toBe(true);
  });
});

describe("odtwarzacz muzyki", () => {
  it("zamienia linki Spotify i YouTube na adresy osadzenia", async () => {
    const { musicEmbed } = await import("@/lib/rk-embed");
    expect(
      musicEmbed("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc"),
    ).toMatchObject({
      provider: "spotify",
      src: "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M",
    });
    expect(musicEmbed("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")?.height).toBe(152);
    expect(musicEmbed("https://www.youtube.com/playlist?list=PLabcdef123456")?.src).toBe(
      "https://www.youtube.com/embed/videoseries?list=PLabcdef123456",
    );
    expect(musicEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(musicEmbed("https://youtu.be/dQw4w9WgXcQ")?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });
  it("odrzuca obce i niebezpieczne adresy", async () => {
    const { musicEmbed } = await import("@/lib/rk-embed");
    for (const bad of [
      "",
      "http://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      "https://evil.example/playlist/37i9dQZF1DXcBWIGoYBM5M",
      "javascript:alert(1)",
      "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=<script>",
    ])
      expect(musicEmbed(bad), bad).toBeNull();
  });
  it("schemat przyjmuje pustą i poprawną playlistę, a stare dane bez pola się wczytują", () => {
    const base = defaultContent().recruitSite;
    expect(recruitSiteSchema.safeParse({ ...base, music: "" }).success).toBe(true);
    expect(
      recruitSiteSchema.safeParse({
        ...base,
        music: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      }).success,
    ).toBe(true);
    expect(recruitSiteSchema.safeParse({ ...base, music: "https://evil.example/x" }).success).toBe(
      false,
    );
    const { music: _m, ...old } = base;
    void _m;
    const r = recruitSiteSchema.safeParse(old);
    expect(r.success && r.data.music).toBe("");
  });
});
