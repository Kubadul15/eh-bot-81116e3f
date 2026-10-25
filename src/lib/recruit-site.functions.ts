import { createServerFn } from "@tanstack/react-start";
import { isSnowflake } from "./bot-slots";
import { LEVELS, STATUSES, type AppStatus, type StaffLevel } from "./recruit-logic";
import type { AppRow, PublicRecruit, RecruitPanel, StaffRow } from "./recruit-types";

// Tabele recruit_* dochodzą z migracji 0003, a plik typów Supabase jest generowany z działającej bazy – dlatego odwołujemy się do nich bez typów,
// żeby kod kompilował się niezależnie od tego, czy typy zdążyły się odświeżyć.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rt = (client: unknown, name: "recruit_applications" | "recruit_staff"): any =>
  (client as { from: (n: string) => unknown }).from(name);

const guildOnly = (d: { guildId: string }) => {
  if (!isSnowflake(d?.guildId)) throw new Error("Zły link do rekrutacji");
  return { guildId: d.guildId };
};
const uuid = (v: unknown) => {
  if (typeof v !== "string" || !/^[0-9a-f-]{36}$/.test(v))
    throw new Error("Zły identyfikator podania");
  return v;
};

// ---------- wspólne (tylko serwer) ----------
async function loadGuild(guildId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { readContent } = await import("./content-config");
  const { metaOf, hasFeature } = await import("./premium");
  const { data } = await supabaseAdmin
    .from("guild_configs")
    .select("settings, content, channels")
    .eq("guild_id", guildId)
    .maybeSingle();
  const meta = metaOf(data?.settings);
  const content = readContent(data?.content);
  const feature = hasFeature(meta, "recruitSite");
  const moduleOff = (meta.disabled ?? []).includes("recruit");
  return {
    meta,
    content,
    channels: (data?.channels ?? {}) as Record<string, string>,
    // strona działa tylko w Premium (albo po nadaniu funkcji), gdy serwer nie jest zablokowany i moduł rekrutacji nie jest wyłączony
    usable: feature && !meta.blocked && !moduleOff,
    reason: meta.blocked
      ? "Ten serwer został zablokowany przez właściciela bota."
      : moduleOff
        ? "Rekrutacja jest wyłączona na tym serwerze."
        : !feature
          ? "Strona rekrutacyjna wymaga planu Premium."
          : "",
  };
}

async function guildInfo(guildId: string) {
  const { bot } = await import("./discord.server");
  const r = await bot(`/guilds/${guildId}`).catch(() => null);
  if (!r?.ok) return { id: guildId, name: "Serwer", icon: null as string | null };
  const g = (await r.json()) as { id: string; name: string; icon: string | null };
  return { id: g.id, name: g.name, icon: g.icon };
}

async function postToChannel(channelId: string | undefined, body: Record<string, unknown>) {
  if (!channelId || !isSnowflake(channelId)) return false;
  const { API } = await import("./discord.server");
  const r = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bot ${process.env["DISCORD_BOT_TOKEN"]}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...body }),
  }).catch(() => null);
  return !!r?.ok;
}

const colorInt = (hex: string) => parseInt(hex.slice(1), 16);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type Access = {
  s: { discord_user_id: string; username: string; avatar: string | null; access_token: string };
  level: StaffLevel | "manage";
};
/** Kto jest kim w panelu: zarządca serwera (uprawnienia Discorda), nadana osoba z listy ekipy, albo nikt. */
async function accessFor(
  guildId: string,
): Promise<{ s: Access["s"] | null; level: Access["level"] | null }> {
  const { getSession, userGuilds, canManage } = await import("./discord.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const s = await getSession();
  if (!s) return { s: null, level: null };
  const guilds = await userGuilds(s.access_token).catch(() => []);
  if (guilds.some((g) => g.id === guildId && canManage(g))) return { s, level: "manage" };
  const { data } = await rt(supabaseAdmin, "recruit_staff")
    .select("level")
    .eq("guild_id", guildId)
    .eq("discord_user_id", s.discord_user_id)
    .maybeSingle();
  const level = data?.level === "review" || data?.level === "view" ? data.level : null;
  return { s, level };
}
async function need(guildId: string, min: "view" | "review" | "manage") {
  const { s, level } = await accessFor(guildId);
  if (!s) throw new Error("Zaloguj się przez Discord");
  const rank = { view: 1, review: 2, manage: 3 } as const;
  if (!level || rank[level] < rank[min]) throw new Error("Brak uprawnień do tej czynności");
  const g = await loadGuild(guildId);
  if (!g.usable) throw new Error(g.reason);
  return { s, level, g };
}

const rowOf = (r: {
  id: string;
  position_id: string;
  position_label: string;
  discord_nick: string;
  discord_id: string | null;
  roblox_nick: string;
  age: number;
  answers: unknown;
  auto_score: number;
  flags: unknown;
  tab_switches: number;
  status: string;
  note: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
}): AppRow => ({
  id: r.id,
  positionId: r.position_id,
  positionLabel: r.position_label,
  discordNick: r.discord_nick,
  discordId: r.discord_id,
  robloxNick: r.roblox_nick,
  age: r.age,
  answers: Array.isArray(r.answers) ? (r.answers as AppRow["answers"]) : [],
  autoScore: r.auto_score,
  flags: Array.isArray(r.flags) ? (r.flags as string[]) : [],
  tabSwitches: r.tab_switches,
  status: (STATUSES as readonly string[]).includes(r.status) ? (r.status as AppStatus) : "pending",
  note: r.note,
  reviewedBy: r.reviewed_by_name,
  reviewedAt: r.reviewed_at,
  createdAt: r.created_at,
});

// ---------- publiczna strona ----------
export const getPublicRecruit = createServerFn({ method: "GET" })
  .inputValidator(guildOnly)
  .handler(async ({ data }): Promise<PublicRecruit> => {
    const g = await loadGuild(data.guildId);
    if (!g.usable || !g.content.recruitSite.enabled) return { state: "unavailable" };
    const { enabled: _enabled, ...site } = g.content.recruitSite;
    void _enabled;
    return {
      state: "ok",
      guild: await guildInfo(data.guildId),
      site,
      open: g.content.recruitment.open,
      positions: g.content.recruitment.positions.map((p) => ({
        id: p.id,
        label: p.label,
        emoji: p.emoji,
        desc: p.desc,
        open: p.open,
      })),
      questions: g.content.recruitment.questions.map((q) => ({
        id: q.id,
        label: q.label,
        style: q.style,
        required: q.required,
        placeholder: q.placeholder,
      })),
    };
  });

type SubmitData = {
  guildId: string;
  positionId: string;
  discordNick: string;
  discordId: string;
  robloxNick: string;
  age: number;
  answers: Record<string, string>;
  agree: boolean;
  tabSwitches: number;
  website: string; // pułapka na boty: prawdziwy człowiek tego pola nie widzi
};
export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((d: SubmitData) => {
    if (!isSnowflake(d?.guildId)) throw new Error("Zły link do rekrutacji");
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(d.answers ?? {}).slice(0, 30))
      if (typeof v === "string" && k.length <= 60) answers[k] = v.slice(0, 2500);
    return {
      guildId: d.guildId,
      positionId: String(d.positionId ?? "").slice(0, 60),
      discordNick: String(d.discordNick ?? "").slice(0, 100),
      discordId: String(d.discordId ?? "").slice(0, 30),
      robloxNick: String(d.robloxNick ?? "").slice(0, 60),
      age: Number(d.age),
      answers,
      agree: d.agree === true,
      tabSwitches: Number(d.tabSwitches) || 0,
      website: String(d.website ?? "").slice(0, 100),
    };
  })
  .handler(async ({ data }) => {
    if (data.website.trim()) return { ok: true as const }; // bot: udajemy, że się udało
    const { validateSubmission, scoreApplication, fingerprint } = await import("./recruit-logic");
    const g = await loadGuild(data.guildId);
    if (!g.usable || !g.content.recruitSite.enabled)
      throw new Error("Rekrutacja jest teraz niedostępna.");
    const checked = validateSubmission(g.content, data);
    if (!checked.ok) throw new Error(checked.errors.join("\n"));
    const c = checked.data;

    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const ip =
      (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "")
        .split(",")[0]
        ?.trim() || "?";
    const ipHash = await fingerprint(ip, data.guildId, process.env["BOT_API_KEY"] ?? "eh");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const site = g.content.recruitSite;
    // blokada ponownego podania: ten sam adres sieciowy albo ten sam nick Discord w czasie blokady, a oczekujące podanie blokuje zawsze
    const nickKey = c.discordNick.toLowerCase();
    const since = new Date(Date.now() - Math.max(1, site.cooldownHours) * 3_600_000).toISOString();
    const { data: recent } = await rt(supabaseAdmin, "recruit_applications")
      .select("discord_nick, ip_hash, status, created_at, position_id")
      .eq("guild_id", data.guildId)
      .order("created_at", { ascending: false })
      .limit(200);
    for (const r of recent ?? []) {
      const same = r.ip_hash === ipHash || r.discord_nick.toLowerCase() === nickKey;
      if (!same) continue;
      if (r.status === "pending" && r.position_id === c.position.id)
        throw new Error(
          "Twoje podanie na to stanowisko jest już rozpatrywane. Poczekaj na decyzję.",
        );
      if (site.cooldownHours > 0 && r.created_at > since)
        throw new Error(
          `Możesz wysłać kolejne podanie po upływie ${site.cooldownHours} h od poprzedniego.`,
        );
    }
    const hourAgo = Date.now() - 3_600_000;
    if (
      (recent ?? []).filter((r: { created_at: string }) => Date.parse(r.created_at) > hourAgo)
        .length >= 60
    )
      throw new Error("Przyjmujemy teraz bardzo dużo podań. Spróbuj ponownie za chwilę.");

    const { score, flags } = scoreApplication(c.answers, site.minChars);
    const { data: row, error } = await rt(supabaseAdmin, "recruit_applications")
      .insert({
        guild_id: data.guildId,
        position_id: c.position.id,
        position_label: c.position.label,
        discord_nick: c.discordNick,
        discord_id: c.discordId,
        roblox_nick: c.robloxNick,
        age: c.age,
        answers: c.answers,
        auto_score: score,
        flags,
        tab_switches: c.tabSwitches,
        ip_hash: ipHash,
      })
      .select("id")
      .single();
    if (error || !row)
      throw new Error("Nie udało się zapisać podania. Spróbuj ponownie za chwilę.");

    // powiadomienie ekipy na kanale „Aplikacje rekrutacyjne” (jeśli ustawiony); błąd Discorda nie unieważnia podania
    const origin = new URL(req.url).origin;
    let budget = 4800;
    const fields = [
      {
        name: "Discord",
        value: clip(c.discordNick + (c.discordId ? ` (<@${c.discordId}>)` : ""), 200),
        inline: true,
      },
      { name: "Roblox", value: c.robloxNick, inline: true },
      { name: "Wiek", value: String(c.age), inline: true },
      {
        name: "Ocena wstępna",
        value: `${score}/100${flags.length ? ` • ${flags.join(", ")}` : ""}`,
        inline: false,
      },
    ];
    for (const a of c.answers) {
      const value = clip(a.a, 300);
      if (budget - value.length - a.q.length < 0) {
        fields.push({ name: "…", value: "Reszta odpowiedzi jest w panelu ekipy.", inline: false });
        break;
      }
      budget -= value.length + a.q.length;
      fields.push({ name: clip(a.q, 250), value, inline: false });
    }
    await postToChannel(g.channels["rekrutacja"], {
      embeds: [
        {
          title: clip(`📝 Nowe podanie: ${c.position.label}`, 250),
          description: `Pełne podanie i decyzja: ${origin}/rekrutacja/${data.guildId}/panel`,
          color: colorInt(site.accent),
          fields,
          footer: { text: `Podanie ${row.id.slice(0, 8)}` },
          timestamp: new Date().toISOString(),
        },
      ],
    });
    return { ok: true as const };
  });

// ---------- panel ekipy ----------
export const getRecruitPanel = createServerFn({ method: "GET" })
  .inputValidator(guildOnly)
  .handler(async ({ data }): Promise<RecruitPanel> => {
    const { s, level } = await accessFor(data.guildId);
    if (!s) return { state: "login" };
    if (!level)
      return { state: "forbidden", user: { id: s.discord_user_id, username: s.username } };
    const g = await loadGuild(data.guildId);
    const guild = await guildInfo(data.guildId);
    if (!g.usable) return { state: "unavailable", guildName: guild.name, reason: g.reason };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: apps } = await rt(supabaseAdmin, "recruit_applications")
      .select("*")
      .eq("guild_id", data.guildId)
      .order("created_at", { ascending: false })
      .limit(500);
    let staff: StaffRow[] = [];
    if (level === "manage") {
      const { data: st } = await rt(supabaseAdmin, "recruit_staff")
        .select("*")
        .eq("guild_id", data.guildId)
        .order("created_at", { ascending: true });
      staff = (st ?? []).map(
        (r: {
          discord_user_id: string;
          username: string;
          level: string;
          added_by: string | null;
          created_at: string;
        }) => ({
          userId: r.discord_user_id,
          username: r.username,
          level: r.level === "view" ? "view" : "review",
          addedBy: r.added_by,
          createdAt: r.created_at,
        }),
      );
    }
    return {
      state: "ok",
      level,
      user: { id: s.discord_user_id, username: s.username, avatar: s.avatar },
      guild,
      apps: (apps ?? []).map(rowOf),
      staff,
      positions: g.content.recruitment.positions.map((p) => ({
        id: p.id,
        label: p.label,
        roleId: p.roleId,
      })),
      siteEnabled: g.content.recruitSite.enabled,
    };
  });

export const reviewApplication = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { guildId: string; id: string; status: AppStatus; note: string; notify: boolean }) => {
      if (!isSnowflake(d?.guildId)) throw new Error("Zły serwer");
      if (!(STATUSES as readonly string[]).includes(d?.status)) throw new Error("Zły status");
      return {
        guildId: d.guildId,
        id: uuid(d.id),
        status: d.status,
        note: String(d.note ?? "").slice(0, 1000),
        notify: d.notify === true,
      };
    },
  )
  .handler(async ({ data }) => {
    const { s, g } = await need(data.guildId, "review");
    const { assertNotMaintenance } = await import("./admin.server");
    await assertNotMaintenance();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: app } = await rt(supabaseAdmin, "recruit_applications")
      .select("*")
      .eq("id", data.id)
      .eq("guild_id", data.guildId)
      .maybeSingle();
    if (!app) throw new Error("Nie znaleziono podania");

    const { error } = await rt(supabaseAdmin, "recruit_applications")
      .update({
        status: data.status,
        note: data.note,
        reviewed_by: s.discord_user_id,
        reviewed_by_name: s.username,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Nie udało się zapisać decyzji");

    const warnings: string[] = [];
    if (data.status !== "pending") {
      const accepted = data.status === "accepted";
      const label = accepted ? "✅ Podanie przyjęte" : "❌ Podanie odrzucone";
      await postToChannel(g.channels["rekrutacja"], {
        embeds: [
          {
            title: clip(`${label}: ${app.position_label}`, 250),
            description: `**${app.discord_nick}** (Roblox: ${app.roblox_nick})\nDecyzja: **${s.username}**${data.note ? `\nUwagi: ${clip(data.note, 800)}` : ""}`,
            color: accepted ? 0x2ecc71 : 0xe74c3c,
            footer: { text: `Podanie ${app.id.slice(0, 8)}` },
          },
        ],
      });
      // wiadomość prywatna i ranga: tylko gdy kandydat podał swoje ID Discord i rekruter zaznaczył powiadomienie
      if (data.notify && app.discord_id) {
        const { API } = await import("./discord.server");
        const headers = {
          authorization: `Bot ${process.env["DISCORD_BOT_TOKEN"]}`,
          "content-type": "application/json",
        };
        const guild = await guildInfo(data.guildId);
        const dm = await fetch(`${API}/users/@me/channels`, {
          method: "POST",
          headers,
          body: JSON.stringify({ recipient_id: app.discord_id }),
        }).catch(() => null);
        const ch = dm?.ok ? ((await dm.json()) as { id: string }) : null;
        const sent = ch
          ? await fetch(`${API}/channels/${ch.id}/messages`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                embeds: [
                  {
                    title: accepted
                      ? `✅ Twoje podanie zostało przyjęte`
                      : `❌ Twoje podanie zostało odrzucone`,
                    description: `Serwer: **${guild.name}**\nStanowisko: **${app.position_label}**${data.note ? `\n\n${clip(data.note, 1500)}` : ""}`,
                    color: accepted ? 0x2ecc71 : 0xe74c3c,
                  },
                ],
              }),
            }).catch(() => null)
          : null;
        if (!sent?.ok)
          warnings.push(
            "Nie udało się wysłać wiadomości prywatnej (kandydat ma je zablokowane albo podał złe ID).",
          );
        const role = g.content.recruitment.positions.find((p) => p.id === app.position_id)?.roleId;
        if (accepted && role) {
          const put = await fetch(
            `${API}/guilds/${data.guildId}/members/${app.discord_id}/roles/${role}`,
            {
              method: "PUT",
              headers: { authorization: headers.authorization },
            },
          ).catch(() => null);
          if (!put?.ok)
            warnings.push(
              "Nie udało się nadać rangi (kandydata nie ma na serwerze albo ranga jest wyżej niż rola bota).",
            );
        }
      }
    }
    return { ok: true as const, warnings };
  });

export const deleteApplication = createServerFn({ method: "POST" })
  .inputValidator((d: { guildId: string; id: string }) => {
    if (!isSnowflake(d?.guildId)) throw new Error("Zły serwer");
    return { guildId: d.guildId, id: uuid(d.id) };
  })
  .handler(async ({ data }) => {
    await need(data.guildId, "manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await rt(supabaseAdmin, "recruit_applications")
      .delete()
      .eq("id", data.id)
      .eq("guild_id", data.guildId);
    if (error) throw new Error("Nie udało się usunąć podania");
    return { ok: true as const };
  });

export const setRecruitStaff = createServerFn({ method: "POST" })
  .inputValidator((d: { guildId: string; userId: string; level: StaffLevel | null }) => {
    if (!isSnowflake(d?.guildId) || !isSnowflake(d?.userId))
      throw new Error("Podaj poprawne ID użytkownika Discord (17–20 cyfr)");
    if (d.level !== null && !(LEVELS as readonly string[]).includes(d.level))
      throw new Error("Zły poziom dostępu");
    return { guildId: d.guildId, userId: d.userId, level: d.level };
  })
  .handler(async ({ data }) => {
    const { s } = await need(data.guildId, "manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.level === null) {
      await rt(supabaseAdmin, "recruit_staff")
        .delete()
        .eq("guild_id", data.guildId)
        .eq("discord_user_id", data.userId);
      return { ok: true as const };
    }
    const { count } = await rt(supabaseAdmin, "recruit_staff")
      .select("discord_user_id", { count: "exact", head: true })
      .eq("guild_id", data.guildId);
    if ((count ?? 0) >= 50) throw new Error("Maksymalnie 50 osób w ekipie rekrutacyjnej");
    const { bot } = await import("./discord.server");
    const u = await bot(`/users/${data.userId}`).catch(() => null);
    if (!u?.ok) throw new Error("Nie znaleziono takiego użytkownika Discord – sprawdź ID");
    const user = (await u.json()) as { username: string; global_name?: string | null };
    const { error } = await rt(supabaseAdmin, "recruit_staff").upsert({
      guild_id: data.guildId,
      discord_user_id: data.userId,
      username: user.global_name || user.username,
      level: data.level,
      added_by: s.discord_user_id,
    });
    if (error) throw new Error("Nie udało się zapisać uprawnień");
    return { ok: true as const };
  });
