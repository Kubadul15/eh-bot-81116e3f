import { describe, expect, it, vi } from "vitest";
import { SUPPORT_GUILD_ID, joinSupportGuild } from "@/lib/support-guild";

const res = (status: number) => ({ status }) as Response;

describe("joinSupportGuild", () => {
  it("wysyła PUT na właściwy serwer z tokenem bota i tokenem użytkownika", async () => {
    const f = vi.fn().mockResolvedValue(res(201));
    const r = await joinSupportGuild("123456789012345678", "tok", { botToken: "BOT", fetchImpl: f });
    expect(r).toBe("added");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://discord.com/api/v10/guilds/${SUPPORT_GUILD_ID}/members/123456789012345678`,
    );
    expect(SUPPORT_GUILD_ID).toBe("1564008126892740618");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bot BOT");
    expect(JSON.parse(String(init.body))).toEqual({ access_token: "tok" });
  });
  it("204 = już jest na serwerze", async () => {
    const f = vi.fn().mockResolvedValue(res(204));
    expect(await joinSupportGuild("123456789012345678", "t", { botToken: "B", fetchImpl: f })).toBe("already");
  });
  it("błędy Discorda i sieci nie przerywają logowania", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = vi.fn().mockResolvedValue(res(403));
    expect(await joinSupportGuild("123456789012345678", "t", { botToken: "B", fetchImpl: bad })).toBe("failed");
    const boom = vi.fn().mockRejectedValue(new Error("timeout"));
    expect(await joinSupportGuild("123456789012345678", "t", { botToken: "B", fetchImpl: boom })).toBe("failed");
  });
  it("bez tokenu bota albo z błędnym ID nic nie wysyła", async () => {
    const f = vi.fn();
    expect(await joinSupportGuild("123456789012345678", "t", { botToken: "", fetchImpl: f })).toBe("failed");
    expect(await joinSupportGuild("../x", "t", { botToken: "B", fetchImpl: f })).toBe("failed");
    expect(await joinSupportGuild("123456789012345678", "", { botToken: "B", fetchImpl: f })).toBe("failed");
    expect(f).not.toHaveBeenCalled();
  });
});