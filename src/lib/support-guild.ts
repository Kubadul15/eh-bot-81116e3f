// Serwer Discord, na który po zalogowaniu na stronie automatycznie dodajemy użytkownika (wymaga zakresu OAuth `guilds.join`;
// Discord pokazuje go na ekranie zgody, a bot musi być na tym serwerze z uprawnieniem „Tworzenie zaproszeń”).
export const SUPPORT_GUILD_ID = "1564008126892740618";

/**
 * Dodaje konto do serwera wsparcia (PUT /guilds/{id}/members/{user}). Działa „po cichu”: nigdy nie rzuca błędu i ma krótki limit czasu,
 * więc problem z Discordem nie blokuje logowania. Zwraca status: "added" (201), "already" (204 – już jest na serwerze) albo "failed".
 */
export async function joinSupportGuild(
  userId: string,
  accessToken: string,
  opts: { botToken?: string; guildId?: string; fetchImpl?: typeof fetch } = {},
): Promise<"added" | "already" | "failed"> {
  const botToken = opts.botToken ?? process.env["DISCORD_BOT_TOKEN"];
  if (!botToken || !/^\d{17,20}$/.test(userId) || !accessToken) return "failed";
  try {
    const r = await (opts.fetchImpl ?? fetch)(
      `https://discord.com/api/v10/guilds/${opts.guildId ?? SUPPORT_GUILD_ID}/members/${userId}`,
      {
        method: "PUT",
        headers: { authorization: `Bot ${botToken}`, "content-type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
        signal: AbortSignal.timeout(4000),
      },
    );
    if (r.status === 201) return "added";
    if (r.status === 204) return "already";
    console.warn(`[auth] nie dodano konta ${userId} na serwer wsparcia: HTTP ${r.status}`);
    return "failed";
  } catch (e) {
    console.warn("[auth] nie dodano konta na serwer wsparcia:", e instanceof Error ? e.message : e);
    return "failed";
  }
}