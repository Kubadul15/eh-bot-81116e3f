// Mądra ocena wstępna podania: sprawdza SENS odpowiedzi, a nie tylko ich długość. Nie używa zewnętrznych usług ani AI – to zestaw reguł,
// które wyłapują losowe znaki, „aaaa”, mashowanie klawiatury, powtórzenia, kopiowanie pytania i odpowiedzi bez treści.
// Wynik to podpowiedź dla rekrutera (punkty, rekomendacja i powody) – o decyzji zawsze rozstrzyga człowiek.

export type Verdict = "accept" | "maybe" | "reject" | "spam";
export const VERDICT_LABEL: Record<Verdict, string> = {
  accept: "Polecam przyjąć",
  maybe: "Do rozważenia",
  reject: "Raczej odrzucić",
  spam: "Odrzuć – wygląda na spam",
};
export const verdictOf = (score: number): Verdict =>
  score <= 15 ? "spam" : score < 45 ? "reject" : score < 70 ? "maybe" : "accept";

export type ScoreInput = { q: string; a: string; style?: "short" | "long" | undefined };
export type AnswerReport = { score: number; nonsense: boolean; notes: string[] };
export type Analysis = {
  score: number;
  verdict: Verdict;
  /** powody: zaczynające się od „+” to plusy, pozostałe to minusy */
  flags: string[];
  perAnswer: AnswerReport[];
};

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
const tokens = (s: string) => fold(s).match(/\p{L}+/gu) ?? [];

// popularne słowa funkcyjne i typowe dla rekrutacji (polskie i trochę angielskich) – zwykły tekst ma ich sporo, losowe znaki wcale
const COMMON = new Set(
  (
    "i w na z do ze sie to nie jest jak co ale czy dla by bo mam chce moze bede ktory ktora ktore juz tak bardzo od po za o u a ten ta te tym tego " +
    "jestem bylem bylam bylo byc moj moje moja moim mnie mi ci go ja ich jego jej nas was wam gdy kiedy gdzie przez oraz tez takze lub albo aby zeby " +
    "jesli gdyby tylko wiec dlatego poniewaz czyli bedzie moge chcialbym chcialabym uwazam lubie gram gra grac serwer serwerze serwera ekipa ekipy ekipie " +
    "administracji administrator moderator moderatorem pomagac pomoc graczom gracze gracz graczy regulamin zasady zasad rp roleplay roblox discord " +
    "doswiadczenie doswiadczenia lat lata rok roku miesiecy czas czasu codziennie dziennie godzin ludzi osob wszystkim wszyscy nowym nowych " +
    "the and to of in is you for it with that my have be are can help because i am was as on at this will want like play game server staff moderator"
  )
    .split(" ")
    .map(fold),
);
const MASH = [
  "asdf",
  "qwer",
  "zxcv",
  "hjkl",
  "jklm",
  "wasd",
  "sdfg",
  "dfgh",
  "fghj",
  "ghjk",
  "lkjh",
  "mnbv",
  "poiu",
  "uiop",
  "qaz",
  "wsx",
  "edc",
  "rfv",
  "ytrewq",
  "xcvb",
];
const VOWELS = new Set("aeiouy");

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let both = 0;
  for (const x of a) if (b.has(x)) both++;
  return both / (a.size + b.size - both);
};

/** Ocena jednej odpowiedzi 0–1. `nonsense` = wygląda jak spam/losowe znaki (obniża wynik całego podania). */
function judge(q: string, a: string, style: "short" | "long", minChars: number): AnswerReport {
  const text = a.trim();
  const folded = fold(text);
  const words = tokens(text);
  const n = words.length;
  const letters = (folded.match(/\p{L}/gu) ?? []).length;
  const notes: string[] = [];
  const fail = (note: string, cap = 0.08): AnswerReport => ({
    score: Math.round(cap * 100),
    nonsense: true,
    notes: [note],
  });

  if (letters < 3 || n === 0) return fail("prawie bez liter", 0);
  if (/(.)\1{3,}/u.test(folded.replace(/\s+/g, "")))
    return fail("powtarzające się znaki (np. „aaaa”)");
  if (MASH.some((m) => folded.includes(m))) return fail("wygląda na losowe uderzanie w klawiaturę");
  const vowels = [...folded].filter((c) => VOWELS.has(c)).length;
  if (letters >= 8 && (vowels / letters < 0.18 || vowels / letters > 0.75))
    return fail("ciąg liter bez sensu");
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const top = Math.max(...freq.values());
  if (n >= 4 && top / n > 0.5) return fail("ciągle to samo słowo");
  const qFold = fold(q.trim());
  if (qFold.length > 12 && folded.includes(qFold))
    return fail("przepisane pytanie zamiast odpowiedzi", 0.15);

  const known = words.filter((w) => COMMON.has(w)).length / n;
  const wordlike =
    words.filter((w) => w.length >= 2 && w.length <= 18 && [...w].some((c) => VOWELS.has(c)))
      .length / n;
  if (n >= 6 && known === 0) {
    notes.push("brak zrozumiałych zdań");
    return { score: 22, nonsense: true, notes };
  }

  // składowe jakości (suma wag = 1)
  const target = Math.max(style === "long" ? 30 : 3, Math.round(minChars / 6));
  const effort = clamp01(n / target);
  const variety = n >= 4 ? clamp01(new Set(words).size / n / 0.8) : 0.6;
  const real = clamp01(known / 0.15) * 0.7 + wordlike * 0.3;
  const structure =
    (/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(text[0] ?? "") ? 0.4 : 0) +
    (/[.,!?;:]/.test(text) ? 0.3 : 0) +
    (n >= 8 && /[,.]/.test(text) ? 0.3 : 0.1);
  const specific = /\d/.test(text) || /\s[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,}/.test(text) ? 1 : 0.3;
  const qStems = new Set(
    tokens(q)
      .filter((w) => w.length > 3)
      .map((w) => w.slice(0, 5)),
  );
  const overlap = clamp01(
    [...new Set(words.map((w) => w.slice(0, 5)))].filter((s) => qStems.has(s)).length / 2,
  );
  let quality =
    effort * 0.3 +
    variety * 0.15 +
    real * 0.25 +
    clamp01(structure) * 0.1 +
    specific * 0.1 +
    overlap * 0.1;
  quality *= 0.3 + 0.7 * Math.sqrt(effort); // krótka odpowiedź na pytanie otwarte nie nadrobi punktów samą poprawnością

  if (effort >= 1 && real > 0.6) notes.push("+rzeczowa, rozbudowana odpowiedź");
  if (specific === 1 && effort > 0.5) notes.push("+konkrety (liczby, nazwy)");
  if (effort < 0.5) notes.push(n <= 2 ? "bardzo krótka odpowiedź" : "krótka, mało konkretów");
  if (variety < 0.5) notes.push("powtarzające się słowa");
  if (letters > 20 && text === text.toUpperCase()) {
    quality *= 0.7;
    notes.push("same wielkie litery");
  }
  if (/https?:\/\//i.test(text)) {
    quality = Math.min(quality, 0.4);
    notes.push("link zamiast odpowiedzi");
  }
  return { score: Math.round(clamp01(quality) * 100), nonsense: false, notes };
}

/** Ocena całego podania: punkty 0–100, rekomendacja i powody (plusy z „+”, minusy bez). */
export function analyzeApplication(
  answers: ScoreInput[],
  minChars: number,
  extra: { tabSwitches?: number; age?: number } = {},
): Analysis {
  if (!answers.length)
    return { score: 0, verdict: "spam", flags: ["brak odpowiedzi"], perAnswer: [] };
  const per = answers.map((x) => judge(x.q, x.a, x.style ?? "long", minChars));

  // identyczne albo niemal identyczne odpowiedzi na różne pytania
  const sets = answers.map((x) => new Set(tokens(x.a)));
  const flags: string[] = [];
  let dup = false;
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++)
      if ((sets[i]?.size ?? 0) >= 3 && jaccard(sets[i]!, sets[j]!) >= 0.8) {
        dup = true;
        for (const k of [i, j]) {
          const r = per[k];
          if (r && !r.nonsense)
            per[k] = {
              score: Math.min(r.score, 25),
              nonsense: false,
              notes: [...r.notes, "kopia innej odpowiedzi"],
            };
        }
      }

  let score = Math.round(per.reduce((s, r) => s + r.score, 0) / per.length);
  const nonsense = per.filter((r) => r.nonsense).length;
  if (nonsense > 0) score = Math.min(score, nonsense * 2 >= per.length ? 12 : 40); // jedna bzdura nie przejdzie, połowa to spam
  if ((extra.tabSwitches ?? 0) > 10) {
    score = Math.max(0, score - 5);
    flags.push("wiele przełączeń kart (możliwe wyszukiwanie odpowiedzi)");
  }
  if (extra.age !== undefined && extra.age < 13)
    flags.push("wiek poniżej 13 lat (regulamin Discorda)");
  if (nonsense) flags.unshift(`${nonsense} z ${per.length} odpowiedzi wygląda na bez sensu`);
  if (dup) flags.push("identyczne odpowiedzi na różne pytania");

  const avgWords = answers.reduce((s, x) => s + tokens(x.a).length, 0) / answers.length;
  if (!nonsense && score >= 70) flags.push("+odpowiedzi rzeczowe i rozbudowane");
  if (!nonsense && avgWords < 6) flags.push("odpowiedzi bardzo krótkie");
  score = Math.max(0, Math.min(100, score));
  return { score, verdict: verdictOf(score), flags, perAnswer: per };
}

/** Skrót: sam wynik i powody. */
export const scoreApplication = (
  answers: ScoreInput[],
  minChars: number,
  extra?: { tabSwitches?: number; age?: number },
) => {
  const { score, flags } = analyzeApplication(answers, minChars, extra);
  return { score, flags };
};
