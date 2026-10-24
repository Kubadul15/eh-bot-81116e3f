import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin.functions", () => ({ trackBuyClick: vi.fn(async () => ({ ok: true })) }));

import { buyMessage, startPurchase } from "@/components/premium-ui";
import { trackBuyClick } from "@/lib/admin.functions";
import { OWNER_PROFILE_URL } from "@/lib/premium";

describe("kupno Premium: wiadomość i profil właściciela", () => {
  it("wiadomość zawiera cenę, serwer, kod i nick", () => {
    const m = buyMessage({
      guildName: "Nova era rp",
      guildId: "1562833250416721980",
      username: "jan",
      code: "EHB-ABCD2345",
      price: 15,
    });
    expect(m).toContain("lifetime, 15 zł");
    expect(m).toContain("Serwer: Nova era rp (ID: 1562833250416721980)");
    expect(m).toContain("Kod rabatowy: EHB-ABCD2345");
    expect(m).toContain("Mój Discord: jan");
  });
  it("bez serwera prosi o podanie w rozmowie, domyślna cena to 20 zł", () => {
    const m = buyMessage({});
    expect(m).toContain("lifetime, 20 zł");
    expect(m).toContain("podam w rozmowie");
    expect(m).not.toContain("Kod rabatowy");
  });
});

describe("startPurchase", () => {
  let open: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    open = vi.fn();
    vi.stubGlobal("open", open);
    vi.mocked(trackBuyClick).mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("kopiuje wiadomość do schowka i otwiera profil właściciela na Discordzie", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const copied = await startPurchase({ guildName: "Serwer", guildId: "1477015035363725596" });
    expect(copied).toBe(true);
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Serwer: Serwer (ID: 1477015035363725596)"),
    );
    expect(open).toHaveBeenCalledWith(OWNER_PROFILE_URL, "_blank", "noopener,noreferrer");
    expect(trackBuyClick).toHaveBeenCalledWith({
      data: { guildId: "1477015035363725596", code: null },
    });
  });

  it("gdy schowek nie działa, i tak otwiera profil i nie wysypuje się", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("blocked");
        }),
      },
    });
    const copied = await startPurchase({});
    expect(copied).toBe(false);
    expect(open).toHaveBeenCalledWith(OWNER_PROFILE_URL, "_blank", "noopener,noreferrer");
  });

  it("błąd zapisu kliknięcia nie przeszkadza w zakupie", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(async () => undefined) } });
    vi.mocked(trackBuyClick).mockRejectedValueOnce(new Error("db"));
    await expect(startPurchase({})).resolves.toBe(true);
    expect(open).toHaveBeenCalled();
  });
});
