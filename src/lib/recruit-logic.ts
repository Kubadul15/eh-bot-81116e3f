// Logika podań ze strony rekrutacyjnej: walidacja formularza względem konfiguracji serwera i wstępna ocena odpowiedzi.
// Czysto funkcyjna (bez bazy i sieci), współdzielona przez stronę formularza (podpowiedzi) i serwer (twarda walidacja).
import type { ContentConfig } from "./content-config";

export const STATUSES = ["pending", "accepted", "rejected"] as const;
export type AppStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<AppStatus, string> = {
  pending: "Oczekuje",
  accepted: "Przyjęte",
  rejected: "Odrzucone",
};
/** Poziomy dostępu do panelu: view – tylko podgląd, review – podgląd i decyzje, manage – właściciel/zarządca serwera (też uprawnienia). */
export const LEVELS = ["view", "review"] as const;
export type StaffLevel = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<StaffLevel | "manage", string> = {
  view: "Podgląd",
  review: "Rekruter",
  manage: "Zarządca",
};

export const MAX_ANSWER = { short: 300, long: 2000 } as const;
export const NICK = { discord: [2, 40], roblox: [3, 20], age: [10, 99] } as const;

export type SubmitInput = {
  positionId: string;
  discordNick: string;
  discordId: string;
  robloxNick: string;
  age: number;
  answers: Record<string, string>;
  agree: boolean;
  tabSwitches: number;
};
export type CleanSubmission = {
  position: { id: string; label: string };
  discordNick: string;
  discordId: string | null;
  robloxNick: string;
  age: number;
  answers: { id: string; q: string; a: string; s: "short" | "long" }[];
  tabSwitches: number;
};

const collapse = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Sprawdza podanie względem konfiguracji. Zwraca oczyszczone dane albo listę błędów po polsku. */
export function validateSubmission(
  content: ContentConfig,
  input: SubmitInput,
): { ok: true; data: CleanSubmission } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const site = content.recruitSite;
  if (!content.recruitment.open) return { ok: false, errors: ["Rekrutacja jest teraz zamknięta."] };
  const position = content.recruitment.positions.find((p) => p.id === input.positionId);
  if (!position) errors.push("Wybierz stanowisko z listy.");
  else if (!position.open) errors.push("To stanowisko jest teraz zamknięte.");

  const discordNick = collapse(String(input.discordNick ?? ""));
  if (discordNick.length < NICK.discord[0] || discordNick.length > NICK.discord[1])
    errors.push(`Nick Discord musi mieć od ${NICK.discord[0]} do ${NICK.discord[1]} znaków.`);
  const robloxNick = collapse(String(input.robloxNick ?? ""));
  if (!/^[A-Za-z0-9_]{3,20}$/.test(robloxNick))
    errors.push("Nick Roblox: 3–20 znaków (litery, cyfry i podkreślenie).");
  const age = Math.floor(Number(input.age));
  if (!Number.isFinite(age) || age < NICK.age[0] || age > NICK.age[1])
    errors.push(`Wiek musi mieścić się w przedziale ${NICK.age[0]}–${NICK.age[1]}.`);
  const discordId = String(input.discordId ?? "").trim();
  if (discordId && !/^\d{17,20}$/.test(discordId))
    errors.push("ID Discord to 17–20 cyfr (albo zostaw puste).");
  if (input.agree !== true) errors.push("Potwierdź, że odpowiedzi napisałeś(-aś) samodzielnie.");

  const answers: CleanSubmission["answers"] = [];
  for (const q of content.recruitment.questions) {
    const raw = collapse(String(input.answers?.[q.id] ?? ""));
    const max = MAX_ANSWER[q.style];
    if (!raw) {
      if (q.required) errors.push(`Uzupełnij odpowiedź: „${q.label}”.`);
      continue;
    }
    if (raw.length > max)
      errors.push(`Odpowiedź „${q.label}” jest za długa (maks. ${max} znaków).`);
    else if (raw.length < site.minChars)
      errors.push(
        `Odpowiedź „${q.label}” jest za krótka (min. ${site.minChars} znaków, masz ${raw.length}).`,
      );
    else answers.push({ id: q.id, q: q.label, a: raw, s: q.style });
  }

  if (errors.length || !position) return { ok: false, errors };
  return {
    ok: true,
    data: {
      position: { id: position.id, label: position.label },
      discordNick,
      discordId: discordId || null,
      robloxNick,
      age,
      answers,
      tabSwitches: Math.min(999, Math.max(0, Math.floor(Number(input.tabSwitches) || 0))),
    },
  };
}

// Ocena wstępna podania mieszka w osobnym module (reguły oceny sensu odpowiedzi).
export {
  analyzeApplication,
  scoreApplication,
  verdictOf,
  VERDICT_LABEL,
  type Verdict,
  type Analysis,
} from "./recruit-score";

/** Odcisk do blokady ponownego podania: bez zapisywania surowego adresu IP. */
export async function fingerprint(ip: string, guildId: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}|${guildId}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
