// Funkcje serwerowe panelu administratora. KAŻDA (poza publicznymi na końcu) sprawdza, że sesja należy do właściciela (OWNER_ID).
// Pliki *.functions.ts trafiają do przeglądarki, więc logikę ładujemy dynamicznie z admin.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isSnowflake, PANEL_KEYS } from "./bot-slots";
import { parseIds, premiumCsvRow, PREMIUM_CSV_HEADER, toCsv } from "./admin-logic";
import { metaOf } from "./premium";

const gid = z.string().refine(isSnowflake, "Złe ID serwera");
const srv = () => import("./admin.server");

// ---------- przegląd i lista ----------
export const adminOverview = createServerFn({ method: "GET" }).handler(async () => {
  const s = await srv();
  await s.requireOwner();
  return s.overview();
});
export const adminServers = createServerFn({ method: "GET" }).handler(async () => {
  const s = await srv();
  await s.requireOwner();
  return s.listServers();
});
export const adminServerDetail = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: gid }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    await s.requireOwner();
    return s.serverDetail(data.id);
  });

// ---------- premium ----------
export const adminGrant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: gid,
        mode: z.enum(["lifetime", "days", "extend"]),
        days: z.number().int().min(1).max(3650).optional(),
        note: z.string().max(200).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    if (data.mode !== "lifetime" && !data.days) throw new Error("Podaj liczbę dni");
    await s.grant(
      me.discord_user_id,
      data.id,
      data.mode === "lifetime" ? { mode: "lifetime" } : { mode: data.mode, days: data.days ?? 1 },
      data.note,
    );
    return { ok: true as const };
  });
export const adminRevoke = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: gid }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.revoke(me.discord_user_id, data.id);
    return { ok: true as const };
  });
export const adminBulkGrant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        text: z.string().max(20000),
        lifetime: z.boolean(),
        days: z.number().int().min(1).max(3650).optional(),
        note: z.string().max(200).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    const ids = parseIds(data.text);
    if (!ids.length) throw new Error("Nie znaleziono żadnych ID serwerów");
    if (!data.lifetime && !data.days) throw new Error("Podaj liczbę dni albo wybierz lifetime");
    return s.bulkGrant(me.discord_user_id, ids, data.lifetime ? null : (data.days ?? 1), data.note);
  });
export const adminAddPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: gid,
        amount: z.number().positive().max(100000),
        method: z.string().max(40).default(""),
        note: z.string().max(120).default(""),
        at: z.string().max(40).optional(),
        code: z.string().max(32).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    return s.addPayment(me.discord_user_id, data.id, {
      amount: data.amount,
      method: data.method,
      note: data.note,
      ...(data.at ? { at: data.at } : {}),
      ...(data.code ? { code: data.code } : {}),
    });
  });
export const adminRemovePayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: gid, paymentId: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.removePayment(me.discord_user_id, data.id, data.paymentId);
    return { ok: true as const };
  });
export const adminPremiumCsv = createServerFn({ method: "GET" }).handler(async () => {
  const s = await srv();
  await s.requireOwner();
  const [servers, rows] = await Promise.all([s.listServers(), s.readAllRows()]);
  const byId = new Map(rows.map((r) => [r.guild_id, metaOf(r.settings)]));
  const out = servers
    .filter((x) => x.premium.active || (byId.get(x.id)?.payments?.length ?? 0) > 0)
    .map((x) => premiumCsvRow(x, byId.get(x.id) ?? {}));
  return { csv: toCsv(PREMIUM_CSV_HEADER, out), count: out.length };
});

// ---------- informacje, moduły, limity, blokada ----------
export const adminUpdateInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: gid,
        note: z.string().max(500),
        contact: z.string().max(120),
        tags: z.array(z.string().max(24)).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.updateInfo(me.discord_user_id, data.id, data);
    return { ok: true as const };
  });
export const adminSetDisabled = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: gid, modules: z.array(z.string().max(30)).max(30) }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.setDisabled(me.discord_user_id, data.id, data.modules);
    return { ok: true as const };
  });
export const adminSetLimits = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: gid, limits: z.record(z.number()) }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.setLimits(me.discord_user_id, data.id, data.limits);
    return { ok: true as const };
  });
export const adminBlock = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: gid, block: z.boolean(), reason: z.string().max(200).default("") }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    if (data.block) await s.block(me.discord_user_id, data.id, data.reason);
    else await s.unblock(me.discord_user_id, data.id);
    return { ok: true as const };
  });

// ---------- konfiguracja serwera ----------
export const adminExportConfig = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: gid }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    await s.requireOwner();
    return s.exportConfig(data.id);
  });
export const adminImportConfig = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: gid, json: z.string().max(2_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.json);
    } catch {
      throw new Error("To nie jest poprawny JSON");
    }
    await s.importConfig(me.discord_user_id, data.id, parsed);
    return { ok: true as const };
  });
export const adminCopyConfig = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ from: gid, to: gid }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.copyConfig(me.discord_user_id, data.from, data.to);
    return { ok: true as const };
  });
export const adminResetConfig = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: gid }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.resetConfig(me.discord_user_id, data.id);
    return { ok: true as const };
  });
export const adminClearPanels = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: gid }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.clearPanels(me.discord_user_id, data.id);
    return { ok: true as const };
  });
export const adminForcePanel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: gid,
        panel: z
          .string()
          .refine((p) => (PANEL_KEYS as readonly string[]).includes(p), "Nieznany panel"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.forcePanel(me.discord_user_id, data.id, data.panel);
    return { ok: true as const };
  });
export const adminDiagnose = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: gid }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    await s.requireOwner();
    return s.diagnose(data.id);
  });

// ---------- wiadomości i bot ----------
export const adminSendTo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: gid,
        channelId: gid,
        title: z.string().max(256).default(""),
        text: z.string().max(4000),
        color: z.string().max(7).default("#5865f2"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    if (!data.title.trim() && !data.text.trim()) throw new Error("Wpisz tytuł lub treść");
    await s.sendTo(me.discord_user_id, data.id, data.channelId, data.title, data.text, data.color);
    return { ok: true as const };
  });
export const adminBroadcast = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        scope: z.enum(["all", "premium", "free"]),
        title: z.string().max(256),
        text: z.string().min(3).max(4000),
        confirm: z.literal(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    return s.broadcast(me.discord_user_id, data.scope, data.title, data.text);
  });
export const adminLeave = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: gid, confirm: z.literal(true) }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.leaveGuild(me.discord_user_id, data.id);
    return { ok: true as const };
  });

// ---------- kody, ogłoszenia, serwis ----------
export const adminCodes = createServerFn({ method: "GET" }).handler(async () => {
  const s = await srv();
  await s.requireOwner();
  return s.listCodes();
});
export const adminCreateCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().max(32).optional(),
        percent: z.number().min(1).max(100),
        maxUses: z.number().int().min(1).max(100000).nullable(),
        days: z.number().int().min(1).max(3650).nullable(),
        note: z.string().max(120).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    return s.createCode(me.discord_user_id, {
      percent: data.percent,
      maxUses: data.maxUses,
      days: data.days,
      note: data.note,
      ...(data.code ? { code: data.code } : {}),
    });
  });
export const adminDeleteCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().max(32) }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.deleteCode(me.discord_user_id, data.code);
    return { ok: true as const };
  });
export const adminSetNotice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        text: z.string().max(300),
        level: z.enum(["info", "warn", "danger"]),
        days: z.number().int().min(1).max(365).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.setNotice(me.discord_user_id, data.text, data.level, data.days);
    return { ok: true as const };
  });
export const adminClearNotice = createServerFn({ method: "POST" }).handler(async () => {
  const s = await srv();
  const me = await s.requireOwner();
  await s.writeGlobal({ notice: null });
  await s.audit(me.discord_user_id, "ogłoszenie-usunięte", null);
  return { ok: true as const };
});
export const adminSetMaintenance = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ on: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    await s.writeGlobal({ maintenance: data.on });
    await s.audit(me.discord_user_id, data.on ? "serwis-włączony" : "serwis-wyłączony", null);
    return { ok: true as const };
  });

// ---------- sesje i narzędzia ----------
export const adminSessions = createServerFn({ method: "GET" }).handler(async () => {
  const s = await srv();
  const me = await s.requireOwner();
  return s.listSessions(me.id);
});
export const adminRevokeSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), allExceptMine: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.allExceptMine) await supabaseAdmin.from("dash_sessions").delete().neq("id", me.id);
    else if (data.id) await supabaseAdmin.from("dash_sessions").delete().eq("id", data.id);
    else throw new Error("Wskaż sesję");
    await s.audit(
      me.discord_user_id,
      data.allExceptMine ? "sesje-wszystkie-unieważnione" : "sesja-unieważniona",
      null,
      data.id ?? "",
    );
    return { ok: true as const };
  });
export const adminStale = createServerFn({ method: "GET" }).handler(async () => {
  const s = await srv();
  await s.requireOwner();
  return s.staleServers();
});
export const adminDeleteStale = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(gid).max(200), confirm: z.literal(true) }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    return { deleted: await s.deleteStale(me.discord_user_id, data.ids) };
  });
export const adminBackup = createServerFn({ method: "GET" }).handler(async () => {
  const s = await srv();
  await s.requireOwner();
  return s.backupAll();
});
export const adminRestore = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ json: z.string().max(20_000_000), confirm: z.literal(true) }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const me = await s.requireOwner();
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.json);
    } catch {
      throw new Error("To nie jest poprawny JSON");
    }
    return s.restoreAll(me.discord_user_id, parsed);
  });
export const adminAudit = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ guild: gid.optional(), limit: z.number().int().min(1).max(500).default(200) })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    await s.requireOwner();
    const a = (await s.readGlobal()).audit;
    return (data.guild ? a.filter((x) => x.guild === data.guild) : a).slice(0, data.limit);
  });

// ====================== PUBLICZNE (bez logowania) ======================
export const getPublicNotice = createServerFn({ method: "GET" }).handler(async () =>
  (await srv()).publicNotice(),
);
export const checkDiscountCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().max(32) }).parse(d))
  .handler(async ({ data }) => (await srv()).checkCode(data.code));
/** Zapisuje kliknięcie „Kup Premium” zalogowanego użytkownika (lead). Dla niezalogowanych nic nie robi. */
export const trackBuyClick = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ guildId: gid.nullable(), code: z.string().max(32).nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = await srv();
    const { getSession } = await import("./discord.server");
    const session = await getSession();
    if (!session) return { ok: true as const };
    await s.trackBuy(session.discord_user_id, session.username, data.guildId, data.code);
    return { ok: true as const };
  });
