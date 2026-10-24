// Warstwa serwerowa panelu administratora: baza (guild_configs, dash_sessions) i Discord API. TYLKO po stronie serwera.
// Dane premium trzymamy w guild_configs.settings._admin, a dane globalne (dziennik, kody, ogłoszenia) w wierszu guild_id = "_global" –
// dzięki temu nie są potrzebne żadne migracje bazy.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { API, getSession } from "./discord.server";
import {
  OWNER_ID,
  grantPremium,
  isLifetime,
  limitsFor,
  metaOf,
  premiumActive,
  MODULE_IDS,
  type AdminMeta,
  type Payment,
} from "./premium";
import type {
  AuditEntry,
  DiagnoseReport,
  DiscountCode,
  Notice,
  Overview,
  PublicNotice,
  ServerDetail,
  ServerRow,
  SessionRow,
} from "./admin-types";
import {
  activeNotice,
  clampText,
  cleanLimits,
  cleanTags,
  codeUsable,
  generateCode,
  normalizeCode,
  permissionReport,
  revenue,
  validateBackup,
  type BackupRow,
} from "./admin-logic";
import { CHANNEL_KEYS, PANEL_SLOTS, isSnowflake } from "./bot-slots";

const GLOBAL_ID = "_global";
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const nowIso = () => new Date().toISOString();

// ====================== DOSTĘP ======================
/** Jedyne konto z dostępem: Discord ID właściciela. Każda inna osoba dostaje ogólny błąd (bez zdradzania, że panel istnieje). */
export async function requireOwner() {
  const s = await getSession();
  if (!s || s.discord_user_id !== OWNER_ID) throw new Error("Brak dostępu");
  return s;
}
export async function isOwnerSession(): Promise<boolean> {
  const s = await getSession();
  return !!s && s.discord_user_id === OWNER_ID;
}

// ====================== DISCORD (token bota) ======================
const discord = (path: string, init?: RequestInit) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bot ${process.env["DISCORD_BOT_TOKEN"]}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
type BotGuild = { id: string; name: string; icon: string | null };

export async function botGuilds(): Promise<BotGuild[]> {
  const all: BotGuild[] = [];
  let after = "";
  for (let page = 0; page < 10; page++) {
    const r = await discord(`/users/@me/guilds?limit=200${after ? `&after=${after}` : ""}`);
    if (!r.ok) throw new Error(`Discord ${r.status} – nie udało się pobrać listy serwerów bota`);
    const part = (await r.json()) as BotGuild[];
    all.push(...part.map((g) => ({ id: g.id, name: g.name, icon: g.icon })));
    if (part.length < 200) break;
    after = part[part.length - 1]?.id ?? "";
  }
  return all;
}

// ====================== BAZA: konfiguracje serwerów ======================
export type Row = {
  guild_id: string;
  channels: Json;
  roles: Json;
  settings: Json;
  content: Json;
  panels: Json;
  updated_by: string | null;
  updated_at: string;
};
export async function readRow(id: string): Promise<Row | null> {
  const { data } = await supabaseAdmin
    .from("guild_configs")
    .select("*")
    .eq("guild_id", id)
    .maybeSingle();
  return (data as Row | null) ?? null;
}
export async function readAllRows(): Promise<Row[]> {
  const { data, error } = await supabaseAdmin
    .from("guild_configs")
    .select("*")
    .neq("guild_id", GLOBAL_ID);
  if (error) throw new Error("Nie udało się odczytać konfiguracji");
  return (data ?? []) as Row[];
}
const settingsOf = (row: Row | null): Obj =>
  isObj(row?.settings) ? { ...(row?.settings as Obj) } : {};

/** Zmienia blok _admin serwera (reszta ustawień klienta zostaje nietknięta). Zwraca nowy stan. */
export async function writeMeta(
  guildId: string,
  mutate: (m: AdminMeta) => AdminMeta,
): Promise<AdminMeta> {
  if (!isSnowflake(guildId)) throw new Error("Złe ID serwera");
  const row = await readRow(guildId);
  const settings = settingsOf(row);
  const next = mutate(structuredClone(metaOf(settings)));
  const clean: AdminMeta = { ...next };
  for (const k of Object.keys(clean) as (keyof AdminMeta)[]) {
    const v = clean[k];
    if (
      v === undefined ||
      (Array.isArray(v) && v.length === 0) ||
      (isObj(v) && Object.keys(v).length === 0 && k !== "premium")
    )
      delete clean[k];
  }
  if (Object.keys(clean).length) settings["_admin"] = clean as unknown as Json;
  else delete settings["_admin"];
  const { error } = await supabaseAdmin
    .from("guild_configs")
    .upsert({ guild_id: guildId, settings: settings as unknown as Json });
  if (error) throw new Error("Nie udało się zapisać zmian");
  return clean;
}

// ====================== BAZA: dane globalne ======================
export type GlobalData = {
  audit: AuditEntry[];
  codes: DiscountCode[];
  notice: Notice | null;
  maintenance: boolean;
};
export async function readGlobal(): Promise<GlobalData> {
  const { data } = await supabaseAdmin
    .from("guild_configs")
    .select("settings")
    .eq("guild_id", GLOBAL_ID)
    .maybeSingle();
  const s = (isObj(data?.settings) ? data.settings : {}) as Partial<GlobalData>;
  return {
    audit: Array.isArray(s.audit) ? s.audit : [],
    codes: Array.isArray(s.codes) ? s.codes : [],
    notice: s.notice ?? null,
    maintenance: !!s.maintenance,
  };
}
export async function writeGlobal(patch: Partial<GlobalData>): Promise<void> {
  const next = { ...(await readGlobal()), ...patch };
  const { error } = await supabaseAdmin.from("guild_configs").upsert({
    guild_id: GLOBAL_ID,
    settings: next as unknown as Json,
    updated_by: OWNER_ID,
    updated_at: nowIso(),
  });
  if (error) throw new Error("Nie udało się zapisać danych globalnych");
}
/** Dziennik audytu: ostatnie 500 operacji administratora. */
export async function audit(
  by: string,
  action: string,
  guild: string | null,
  details = "",
): Promise<void> {
  const g = await readGlobal();
  await writeGlobal({
    audit: [
      { at: nowIso(), by, action, guild, details: clampText(details, 300) },
      ...g.audit,
    ].slice(0, 500),
  });
}
export async function publicNotice(): Promise<PublicNotice> {
  const g = await readGlobal();
  return { notice: activeNotice(g.notice), maintenance: g.maintenance };
}
/** Tryb serwisowy: zwykli użytkownicy nie mogą zapisywać zmian (administrator – może). */
export async function assertNotMaintenance(): Promise<void> {
  if (!(await readGlobal()).maintenance) return;
  if (await isOwnerSession()) return;
  throw new Error(
    "Trwają prace serwisowe – zapis zmian jest chwilowo wyłączony. Spróbuj za kilka minut.",
  );
}

// ====================== WIDOKI ======================
export function toServerRow(
  id: string,
  g: BotGuild | null,
  row: Row | null,
  now = Date.now(),
): ServerRow {
  const m = metaOf(row?.settings);
  return {
    id,
    name: g?.name ?? `(bota nie ma na serwerze) ${id}`,
    icon: g?.icon ?? null,
    botIn: !!g,
    configured: !!row,
    premium: {
      active: premiumActive(m, now),
      lifetime: isLifetime(m),
      until: m.premium?.until ?? null,
    },
    blocked: m.blocked?.reason ?? null,
    disabled: m.disabled?.length ?? 0,
    note: m.note ?? "",
    tags: m.tags ?? [],
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  };
}
export async function listServers(): Promise<ServerRow[]> {
  const [guilds, rows] = await Promise.all([botGuilds(), readAllRows()]);
  const byId = new Map(rows.map((r) => [r.guild_id, r]));
  const out = guilds.map((g) => toServerRow(g.id, g, byId.get(g.id) ?? null));
  for (const r of rows)
    if (!guilds.some((g) => g.id === r.guild_id)) out.push(toServerRow(r.guild_id, null, r));
  return out.sort(
    (a, b) =>
      Number(b.premium.active) - Number(a.premium.active) || a.name.localeCompare(b.name, "pl"),
  );
}

export async function overview(): Promise<Overview> {
  const [servers, rows, g, sessions] = await Promise.all([
    listServers(),
    readAllRows(),
    readGlobal(),
    supabaseAdmin
      .from("dash_sessions")
      .select("id", { count: "exact", head: true })
      .gt("expires_at", nowIso()),
  ]);
  const payments = rows.flatMap((r) => metaOf(r.settings).payments ?? []);
  const rev = revenue(payments);
  const now = Date.now();
  const soon = servers.filter(
    (s) =>
      s.premium.active &&
      !s.premium.lifetime &&
      s.premium.until &&
      Date.parse(s.premium.until) - now < 7 * 86_400_000,
  );
  return {
    botGuilds: servers.filter((s) => s.botIn).length,
    configured: rows.length,
    premiumActive: servers.filter((s) => s.premium.active).length,
    lifetime: servers.filter((s) => s.premium.lifetime).length,
    timed: servers.filter((s) => s.premium.active && !s.premium.lifetime).length,
    free: servers.filter((s) => s.botIn && !s.premium.active).length,
    blocked: servers.filter((s) => s.blocked).length,
    revenueTotal: rev.total,
    revenueMonth: rev.month,
    monthly: rev.monthly,
    expiringSoon: soon,
    recent: g.audit.slice(0, 8),
    sessions: sessions.count ?? 0,
    maintenance: g.maintenance,
    notice: activeNotice(g.notice),
  };
}

export async function serverDetail(id: string): Promise<ServerDetail> {
  if (!isSnowflake(id)) throw new Error("Złe ID serwera");
  const [row, info] = await Promise.all([
    readRow(id),
    discord(`/guilds/${id}?with_counts=true`).then(async (r) =>
      r.ok
        ? ((await r.json()) as {
            id: string;
            name: string;
            icon: string | null;
            owner_id: string;
            approximate_member_count?: number;
          })
        : null,
    ),
  ]);
  const m = metaOf(row?.settings);
  const base = toServerRow(id, info ? { id, name: info.name, icon: info.icon } : null, row);
  return {
    ...base,
    ownerId: info?.owner_id ?? null,
    members: info?.approximate_member_count ?? null,
    contact: m.contact ?? "",
    payments: m.payments ?? [],
    grant: m.premium ?? null,
    limits: m.limits ?? {},
    effectiveLimits: limitsFor(m),
    disabledModules: m.disabled ?? [],
    channelsSet: isObj(row?.channels) ? Object.keys(row.channels).length : 0,
    rolesSet: isObj(row?.roles) ? Object.keys(row.roles).length : 0,
    pendingPanels: isObj(row?.panels) ? Object.keys(row.panels) : [],
    blockedInfo: m.blocked ?? null,
  };
}

// ====================== PREMIUM ======================
export type GrantMode =
  { mode: "lifetime" } | { mode: "days"; days: number } | { mode: "extend"; days: number };
export async function grant(
  by: string,
  id: string,
  g: GrantMode,
  note: string,
  source: "admin" | "payment" | "gift" | "bulk" = "admin",
): Promise<AdminMeta> {
  const days = g.mode === "lifetime" ? null : Math.min(3650, Math.max(1, Math.floor(g.days)));
  const m = await writeMeta(id, (cur) => ({
    ...cur,
    premium: grantPremium(cur, { days, by, source, note: clampText(note, 200) }),
  }));
  await audit(
    by,
    g.mode === "lifetime"
      ? "premium-lifetime"
      : g.mode === "days"
        ? "premium-dni"
        : "premium-przedłużenie",
    id,
    `${days === null ? "lifetime" : `${days} dni`}${note ? ` • ${clampText(note, 80)}` : ""}`,
  );
  return m;
}
export async function revoke(by: string, id: string): Promise<void> {
  await writeMeta(id, (cur) => {
    const { premium: _p, ...rest } = cur;
    return rest;
  });
  await audit(by, "premium-cofnięte", id);
}
export async function addPayment(
  by: string,
  id: string,
  p: { amount: number; method: string; note: string; at?: string; code?: string },
): Promise<Payment> {
  const amount = Math.round(Number(p.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000)
    throw new Error("Kwota musi być dodatnia (max 100 000)");
  const at = p.at && !Number.isNaN(Date.parse(p.at)) ? new Date(p.at).toISOString() : nowIso();
  const pay: Payment = {
    id: crypto.randomUUID().slice(0, 8),
    amount,
    at,
    method: clampText(p.method, 40) || "inne",
    note: clampText(p.note, 120),
    by,
  };
  await writeMeta(id, (cur) => ({
    ...cur,
    payments: [pay, ...(cur.payments ?? [])].slice(0, 200),
  }));
  const code = normalizeCode(p.code ?? "");
  if (code) {
    const g = await readGlobal();
    await writeGlobal({
      codes: g.codes.map((c) => (c.code === code ? { ...c, used: c.used + 1 } : c)),
    });
  }
  await audit(by, "płatność", id, `${amount} zł • ${pay.method}${code ? ` • kod ${code}` : ""}`);
  return pay;
}
export async function removePayment(by: string, id: string, paymentId: string): Promise<void> {
  await writeMeta(id, (cur) => ({
    ...cur,
    payments: (cur.payments ?? []).filter((x) => x.id !== paymentId),
  }));
  await audit(by, "płatność-usunięta", id, paymentId);
}
export async function updateInfo(
  by: string,
  id: string,
  v: { note: unknown; contact: unknown; tags: unknown },
): Promise<void> {
  await writeMeta(id, (cur) => ({
    ...cur,
    note: clampText(v.note, 500),
    contact: clampText(v.contact, 120),
    tags: cleanTags(v.tags),
  }));
  await audit(by, "notatka", id);
}
export async function setDisabled(by: string, id: string, modules: unknown): Promise<void> {
  const list = (Array.isArray(modules) ? modules : []).filter(
    (m): m is string => typeof m === "string" && MODULE_IDS.includes(m),
  );
  await writeMeta(id, (cur) => ({ ...cur, disabled: [...new Set(list)] }));
  await audit(
    by,
    "moduły",
    id,
    list.length ? `wyłączone: ${list.join(", ")}` : "wszystkie włączone",
  );
}
export async function setLimits(by: string, id: string, limits: unknown): Promise<void> {
  const l = cleanLimits(limits);
  await writeMeta(id, (cur) => ({ ...cur, limits: l }));
  await audit(by, "limity", id, JSON.stringify(l));
}
export async function block(by: string, id: string, reason: string): Promise<void> {
  await writeMeta(id, (cur) => ({
    ...cur,
    blocked: { reason: clampText(reason, 200) || "naruszenie regulaminu", at: nowIso(), by },
  }));
  await audit(by, "blokada", id, reason);
}
export async function unblock(by: string, id: string): Promise<void> {
  await writeMeta(id, (cur) => {
    const { blocked: _b, ...rest } = cur;
    return rest;
  });
  await audit(by, "odblokowanie", id);
}
export async function bulkGrant(
  by: string,
  ids: string[],
  days: number | null,
  note: string,
): Promise<{ ok: string[]; failed: string[] }> {
  const ok: string[] = [],
    failed: string[] = [];
  for (const id of ids) {
    try {
      await grant(
        by,
        id,
        days === null ? { mode: "lifetime" } : { mode: "extend", days },
        note,
        "bulk",
      );
      ok.push(id);
    } catch {
      failed.push(id);
    }
  }
  return { ok, failed };
}

// ====================== KONFIGURACJA SERWERA ======================
const stripAdmin = (settings: unknown): Obj => {
  const s = isObj(settings) ? { ...settings } : {};
  delete s["_admin"];
  return s;
};
export async function exportConfig(
  id: string,
): Promise<{ guild_id: string; channels: Json; roles: Json; settings: Json; content: Json }> {
  const row = await readRow(id);
  if (!row) throw new Error("Ten serwer nie ma zapisanej konfiguracji");
  return {
    guild_id: id,
    channels: row.channels,
    roles: row.roles,
    settings: stripAdmin(row.settings) as unknown as Json,
    content: row.content,
  };
}
export async function importConfig(by: string, id: string, raw: unknown): Promise<void> {
  const v = validateBackup({ rows: [{ ...(isObj(raw) ? raw : {}), guild_id: id }] });
  const r = v.rows[0];
  if (!r) throw new Error(v.errors[0] ?? "Nieprawidłowa konfiguracja");
  const row = await readRow(id);
  const settings = {
    ...stripAdmin(r.settings),
    ...(isObj(row?.settings) && isObj(row.settings["_admin"])
      ? { _admin: row.settings["_admin"] }
      : {}),
  };
  const { error } = await supabaseAdmin.from("guild_configs").upsert({
    guild_id: id,
    channels: r.channels as Json,
    roles: r.roles as Json,
    settings: settings as unknown as Json,
    content: r.content as Json,
    updated_by: by,
    updated_at: nowIso(),
  });
  if (error) throw new Error("Nie udało się zaimportować konfiguracji");
  await audit(by, "import-konfiguracji", id);
}
/** Kopiuje ustawienia liczbowe i wiadomości (rekrutacja, embedy). Kanałów i rang NIE kopiujemy – ich ID są przypisane do konkretnego serwera. */
export async function copyConfig(by: string, from: string, to: string): Promise<void> {
  if (from === to) throw new Error("Wybierz dwa różne serwery");
  const src = await readRow(from);
  if (!src) throw new Error("Serwer źródłowy nie ma konfiguracji");
  const dst = await readRow(to);
  const settings = {
    ...stripAdmin(src.settings),
    ...(isObj(dst?.settings) && isObj(dst.settings["_admin"])
      ? { _admin: dst.settings["_admin"] }
      : {}),
  };
  const { error } = await supabaseAdmin.from("guild_configs").upsert({
    guild_id: to,
    settings: settings as unknown as Json,
    content: src.content,
    updated_by: by,
    updated_at: nowIso(),
  });
  if (error) throw new Error("Nie udało się skopiować");
  await audit(by, "kopiowanie-konfiguracji", to, `z ${from}`);
}
export async function resetConfig(by: string, id: string): Promise<void> {
  const row = await readRow(id);
  const keep =
    isObj(row?.settings) && isObj(row.settings["_admin"]) ? { _admin: row.settings["_admin"] } : {};
  const { error } = await supabaseAdmin.from("guild_configs").upsert({
    guild_id: id,
    channels: {},
    roles: {},
    settings: keep as unknown as Json,
    content: {},
    panels: {},
    updated_by: by,
    updated_at: nowIso(),
  });
  if (error) throw new Error("Nie udało się zresetować");
  await audit(by, "reset-konfiguracji", id);
}
export async function clearPanels(by: string, id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("guild_configs")
    .update({ panels: {} })
    .eq("guild_id", id);
  if (error) throw new Error("Nie udało się wyczyścić");
  await audit(by, "wyczyszczenie-paneli", id);
}
export async function forcePanel(by: string, id: string, panel: string): Promise<void> {
  const def = PANEL_SLOTS.find((p) => p.key === panel);
  if (!def) throw new Error("Nieznany panel");
  const row = await readRow(id);
  if (!isObj(row?.channels) || !isSnowflake(row.channels[def.slot]))
    throw new Error("Ten serwer nie ma ustawionego kanału dla tego panelu");
  const panels = { ...(isObj(row.panels) ? row.panels : {}), [panel]: nowIso() };
  const { error } = await supabaseAdmin
    .from("guild_configs")
    .update({ panels: panels as unknown as Json })
    .eq("guild_id", id);
  if (error) throw new Error("Nie udało się zlecić wysyłki");
  await audit(by, "wymuszony-panel", id, panel);
}

export async function diagnose(id: string): Promise<DiagnoseReport> {
  const [row, gr, rr] = await Promise.all([
    readRow(id),
    discord(`/guilds/${id}`),
    discord(`/guilds/${id}/roles`),
  ]);
  const clientId = process.env["DISCORD_CLIENT_ID"] ?? "";
  const rep: DiagnoseReport = {
    guildName: "",
    botIn: gr.ok && rr.ok,
    permissions: [],
    missingChannels: [],
    missingRoles: [],
    okChannels: 0,
    okRoles: 0,
  };
  if (!rep.botIn) return rep;
  rep.guildName = ((await gr.json()) as { name: string }).name;
  const roles = (await rr.json()) as { id: string; permissions: string }[];
  const mr = await discord(`/guilds/${id}/members/${clientId}`);
  if (mr.ok) {
    const mine = ((await mr.json()) as { roles: string[] }).roles;
    let bits = BigInt(roles.find((r) => r.id === id)?.permissions ?? "0");
    for (const r of roles) if (mine.includes(r.id)) bits |= BigInt(r.permissions);
    rep.permissions = permissionReport(bits);
  }
  const chans = isObj(row?.channels) ? (row.channels as Obj) : {};
  for (const [key, val] of Object.entries(chans)) {
    if (!CHANNEL_KEYS.includes(key) || typeof val !== "string") continue;
    const c = await discord(`/channels/${val}`);
    if (c.ok) rep.okChannels++;
    else
      rep.missingChannels.push({
        key,
        id: val,
        reason: c.status === 404 ? "kanał nie istnieje" : "bot nie ma dostępu",
      });
  }
  const known = new Set(roles.map((r) => r.id));
  const rl = isObj(row?.roles) ? (row.roles as Obj) : {};
  for (const [key, val] of Object.entries(rl)) {
    for (const rid of Array.isArray(val) ? val : typeof val === "string" && val ? [val] : []) {
      if (typeof rid !== "string") continue;
      if (known.has(rid)) rep.okRoles++;
      else rep.missingRoles.push({ key, id: rid });
    }
  }
  return rep;
}

// ====================== WIADOMOŚCI ======================
export async function sendTo(
  by: string,
  id: string,
  channelId: string,
  title: string,
  text: string,
  colorHex: string,
): Promise<string> {
  const ch = await discord(`/channels/${channelId}`);
  if (!ch.ok) throw new Error("Kanał jest niedostępny dla bota");
  const info = (await ch.json()) as { guild_id: string; type: number };
  if (info.guild_id !== id || ![0, 5].includes(info.type))
    throw new Error("Wybierz zwykły kanał tekstowy z tego serwera");
  const color = /^#[0-9a-fA-F]{6}$/.test(colorHex) ? parseInt(colorHex.slice(1), 16) : 0x5865f2;
  const r = await discord(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: clampText(title, 256) || undefined,
          description: clampText(text, 4000) || undefined,
          color,
        },
      ],
    }),
  });
  if (!r.ok) throw new Error("Nie udało się wysłać – sprawdź uprawnienia bota");
  await audit(by, "wiadomość-do-serwera", id, clampText(title || text, 80));
  return ((await r.json()) as { id: string }).id;
}
/** Ogłoszenie do wielu serwerów: na ich kanał systemowy (ten, na który Discord wysyła powitania). */
export async function broadcast(
  by: string,
  scope: "all" | "premium" | "free",
  title: string,
  text: string,
): Promise<{ sent: number; skipped: string[] }> {
  const servers = (await listServers()).filter(
    (s) =>
      s.botIn &&
      (scope === "all" || (scope === "premium" ? s.premium.active : !s.premium.active)) &&
      !s.blocked,
  );
  let sent = 0;
  const skipped: string[] = [];
  for (const s of servers) {
    try {
      const g = await discord(`/guilds/${s.id}`);
      const sys = g.ok
        ? ((await g.json()) as { system_channel_id: string | null }).system_channel_id
        : null;
      if (!sys) {
        skipped.push(`${s.name} (brak kanału systemowego)`);
        continue;
      }
      const r = await discord(`/channels/${sys}/messages`, {
        method: "POST",
        body: JSON.stringify({
          allowed_mentions: { parse: [] },
          embeds: [
            {
              title: clampText(title, 256) || "Ogłoszenie",
              description: clampText(text, 4000),
              color: 0x5865f2,
            },
          ],
        }),
      });
      if (r.ok) sent++;
      else skipped.push(`${s.name} (${r.status})`);
    } catch {
      skipped.push(s.name);
    }
    await new Promise((res) => setTimeout(res, 400)); // łagodnie dla limitów Discorda
  }
  await audit(
    by,
    "ogłoszenie-masowe",
    null,
    `${scope}: ${sent}/${servers.length} • ${clampText(title, 60)}`,
  );
  return { sent, skipped };
}
export async function leaveGuild(by: string, id: string): Promise<void> {
  const r = await discord(`/users/@me/guilds/${id}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404)
    throw new Error(`Discord ${r.status} – nie udało się opuścić serwera`);
  await audit(by, "bot-opuścił-serwer", id);
}

// ====================== KODY, OGŁOSZENIA, SESJE, NARZĘDZIA ======================
export async function setNotice(
  by: string,
  text: string,
  level: Notice["level"],
  days: number | null,
): Promise<void> {
  const t = clampText(text, 300);
  if (!t) throw new Error("Wpisz treść ogłoszenia");
  const lv = (["info", "warn", "danger"] as const).includes(level) ? level : "info";
  await writeGlobal({
    notice: {
      text: t,
      level: lv,
      until: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
      at: nowIso(),
    },
  });
  await audit(by, "ogłoszenie", null, t.slice(0, 80));
}
export async function listSessions(mySessionId: string): Promise<SessionRow[]> {
  const { data } = await supabaseAdmin
    .from("dash_sessions")
    .select("id, discord_user_id, username, created_at, expires_at")
    .gt("expires_at", nowIso())
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((s) => ({
    id: s.id,
    userId: s.discord_user_id,
    username: s.username,
    createdAt: s.created_at,
    expiresAt: s.expires_at,
    mine: s.id === mySessionId,
  }));
}
export async function backupAll(): Promise<{ version: 1; at: string; rows: BackupRow[] }> {
  const rows = await readAllRows();
  return {
    version: 1,
    at: nowIso(),
    rows: rows.map((r) => ({
      guild_id: r.guild_id,
      channels: r.channels,
      roles: r.roles,
      settings: r.settings,
      content: r.content,
    })),
  };
}
export async function restoreAll(
  by: string,
  raw: unknown,
): Promise<{ restored: number; errors: string[] }> {
  const v = validateBackup(raw);
  let restored = 0;
  for (const r of v.rows) {
    const { error } = await supabaseAdmin.from("guild_configs").upsert({
      guild_id: r.guild_id,
      channels: r.channels as Json,
      roles: r.roles as Json,
      settings: r.settings as Json,
      content: r.content as Json,
      updated_by: by,
      updated_at: nowIso(),
    });
    if (error) v.errors.push(`${r.guild_id}: błąd zapisu`);
    else restored++;
  }
  await audit(by, "przywrócenie-kopii", null, `${restored} serwerów`);
  return { restored, errors: v.errors.slice(0, 20) };
}
export async function staleServers(): Promise<ServerRow[]> {
  return (await listServers()).filter((s) => !s.botIn);
}
export async function deleteStale(by: string, ids: string[]): Promise<number> {
  const stale = new Set((await staleServers()).map((s) => s.id));
  const todo = ids.filter((i) => stale.has(i) && isSnowflake(i));
  for (const id of todo) {
    const row = await readRow(id);
    if (premiumActive(metaOf(row?.settings))) continue; // nie kasujemy konfiguracji aktywnych klientów Premium
    await supabaseAdmin.from("guild_configs").delete().eq("guild_id", id);
  }
  await audit(by, "usunięcie-nieaktualnych", null, `${todo.length} konfiguracji`);
  return todo.length;
}

// ====================== KODY RABATOWE ======================
export async function listCodes(): Promise<DiscountCode[]> {
  return (await readGlobal()).codes;
}
export async function createCode(
  by: string,
  v: { code?: string; percent: number; maxUses: number | null; days: number | null; note: string },
): Promise<DiscountCode> {
  const percent = Math.round(v.percent);
  if (!(percent >= 1 && percent <= 100)) throw new Error("Rabat: 1–100%");
  const g = await readGlobal();
  const code = normalizeCode(v.code ?? "") || generateCode();
  if (g.codes.some((c) => c.code === code)) throw new Error("Taki kod już istnieje");
  const c: DiscountCode = {
    code,
    percent,
    maxUses: v.maxUses && v.maxUses > 0 ? Math.floor(v.maxUses) : null,
    used: 0,
    note: clampText(v.note, 120),
    createdAt: nowIso(),
    expiresAt:
      v.days && v.days > 0 ? new Date(Date.now() + v.days * 86_400_000).toISOString() : null,
  };
  await writeGlobal({ codes: [c, ...g.codes].slice(0, 200) });
  await audit(by, "kod-utworzony", null, `${code} −${percent}%`);
  return c;
}
export async function deleteCode(by: string, code: string): Promise<void> {
  const g = await readGlobal();
  await writeGlobal({ codes: g.codes.filter((c) => c.code !== normalizeCode(code)) });
  await audit(by, "kod-usunięty", null, code);
}
/** Publiczne sprawdzenie kodu na stronie Cennik (nie zdradza nic poza ważnością i rabatem). */
export async function checkCode(
  code: string,
): Promise<{ valid: boolean; percent?: number; reason?: string }> {
  const c = (await readGlobal()).codes.find((x) => x.code === normalizeCode(code));
  if (!c) return { valid: false, reason: "Nieznany kod" };
  const u = codeUsable(c);
  return u.ok
    ? { valid: true, percent: c.percent }
    : { valid: false, reason: u.reason ?? "Kod jest nieważny" };
}

// ====================== LEADY: kliknięcia „Kup Premium” ======================
/** Zapisuje, kto kliknął „Kup” (żebyś widział zainteresowanych w dzienniku). Ten sam użytkownik+serwer najwyżej raz na godzinę. */
export async function trackBuy(
  userId: string,
  username: string,
  guildId: string | null,
  code: string | null,
): Promise<void> {
  const g = await readGlobal();
  const hourAgo = Date.now() - 3_600_000;
  if (
    g.audit.some(
      (a) =>
        a.action === "kliknięcie-kup" &&
        a.by === userId &&
        a.guild === guildId &&
        Date.parse(a.at) > hourAgo,
    )
  )
    return;
  await audit(
    userId,
    "kliknięcie-kup",
    guildId,
    `${clampText(username, 40)}${code ? ` • kod ${normalizeCode(code)}` : ""}`,
  );
}

// ====================== ZAPROSZENIE DLA WŁAŚCICIELA ======================
/** Tworzy jednorazowe zaproszenie (ważne 1 godzinę), żeby właściciel mógł wejść na serwer klienta (np. do wsparcia). */
export async function createInvite(
  by: string,
  id: string,
): Promise<{ url: string; channel: string }> {
  if (!isSnowflake(id)) throw new Error("Złe ID serwera");
  const gr = await discord(`/guilds/${id}`);
  if (!gr.ok) throw new Error("Bota nie ma na tym serwerze");
  const info = (await gr.json()) as {
    system_channel_id: string | null;
    rules_channel_id: string | null;
  };
  const cr = await discord(`/guilds/${id}/channels`);
  const chans = cr.ok
    ? ((await cr.json()) as { id: string; type: number; name: string; position: number }[])
    : [];
  const text = chans
    .filter((c) => c.type === 0 || c.type === 5)
    .sort((a, b) => a.position - b.position);
  // najpierw kanał systemowy i regulaminowy, potem pozostałe tekstowe (maks. 6 prób – bot może nie mieć uprawnienia na części kanałów)
  const order = [info.system_channel_id, info.rules_channel_id, ...text.map((c) => c.id)].filter(
    (x): x is string => !!x,
  );
  const tried = [...new Set(order)].slice(0, 6);
  let last = 0;
  for (const ch of tried) {
    const r = await discord(`/channels/${ch}/invites`, {
      method: "POST",
      body: JSON.stringify({ max_age: 3600, max_uses: 1, unique: true, temporary: false }),
    });
    last = r.status;
    if (r.ok) {
      const code = ((await r.json()) as { code: string }).code;
      await audit(by, "zaproszenie", id, `kanał ${ch}`);
      return {
        url: `https://discord.gg/${code}`,
        channel: text.find((c) => c.id === ch)?.name ?? ch,
      };
    }
  }
  throw new Error(
    last === 403 || last === 0
      ? "Bot nie ma uprawnienia „Tworzenie zaproszeń” na tym serwerze – nadaj je jego randze albo zaproś bota ponownie nowym linkiem."
      : `Discord odrzucił zaproszenie (${last})`,
  );
}
