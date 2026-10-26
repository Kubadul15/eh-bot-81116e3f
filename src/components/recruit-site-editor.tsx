import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ExternalLink, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { LockBanner } from "./premium-ui";
import { SITE_FAQ_MAX, type ContentConfig, type RecruitSiteConfig } from "@/lib/content-config";
import { uploadImage } from "@/lib/content.functions";
import { useI18n } from "@/lib/i18n-react";

type Props = {
  guildId: string;
  guildName: string;
  value: ContentConfig;
  onChange: (v: ContentConfig) => void;
  /** czy serwer ma dostęp do strony rekrutacyjnej (Premium albo funkcja nadana przez właściciela bota) */
  allowed: boolean;
};

const lab = "mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

export function RecruitSiteEditor({ guildId, guildName, value, onChange, allowed }: Props) {
  const { t } = useI18n();
  const s = value.recruitSite;
  const set = (patch: Partial<RecruitSiteConfig>) =>
    onChange({ ...value, recruitSite: { ...s, ...patch } });
  const upload = useServerFn(uploadImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const links = {
    page: `${origin}/rekrutacja/${guildId}`,
    panel: `${origin}/rekrutacja/${guildId}/panel`,
  };
  const copy = async (k: keyof typeof links) => {
    try {
      await navigator.clipboard.writeText(links[k]);
      setCopied(k);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* brak schowka */
    }
  };
  async function addBanner(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.set("guildId", guildId);
      data.set("file", file);
      set({ banner: (await upload({ data })).url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać zdjęcia");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!allowed && (
        <LockBanner
          title={t("Strona rekrutacyjna to funkcja Premium")}
          guildId={guildId}
          guildName={guildName}
        >
          {t(
            "Własna strona z formularzem, panel ekipy z uprawnieniami i decyzjami. Możesz ją skonfigurować już teraz, ale zapisanie z włączoną stroną wymaga Premium.",
          )}
        </LockBanner>
      )}

      <label className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
        <span>
          <span className="block font-bold">{t("Strona rekrutacyjna włączona")}</span>
          <span className="text-xs text-muted-foreground">
            {t(
              "Gdy wyłączona, link pokazuje „niedostępne”. Pytania i stanowiska ustawiasz w bloku „Formularz i stanowiska” powyżej.",
            )}
          </span>
        </span>
        <Switch
          aria-label={t("Strona rekrutacyjna włączona")}
          checked={s.enabled}
          disabled={!allowed && !s.enabled}
          onCheckedChange={(enabled) => set({ enabled })}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["page", "Link dla kandydatów", links.page],
            ["panel", "Panel ekipy (podania i decyzje)", links.panel],
          ] as const
        ).map(([k, title, url]) => (
          <div key={k} className="rounded-xl border bg-card p-3">
            <p className={lab}>{title}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">
                {url}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copy(k)}
                aria-label={t("Kopiuj: {title}", { title })}
              >
                {copied === k ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("Otwórz: {title}", { title })}
                >
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "Nowe podania trafiają też na kanał „Aplikacje rekrutacyjne” (ustaw go w kategorii Rekrutacja). W panelu ekipy nadajesz uprawnienia rekruterom po ich ID Discord.",
        )}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lab}>{t("Nagłówek")}</label>
          <Input value={s.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className={lab}>{t("Opis pod nagłówkiem")}</label>
          <Textarea
            value={s.intro}
            maxLength={500}
            rows={3}
            onChange={(e) => set({ intro: e.target.value })}
          />
        </div>
        <div>
          <label className={lab}>{t("Kolor główny")}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={t("Kolor główny")}
              value={s.accent}
              onChange={(e) => set({ accent: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent"
            />
            <Input
              value={s.accent}
              maxLength={7}
              onChange={(e) =>
                /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && set({ accent: e.target.value })
              }
            />
          </div>
        </div>
        <div>
          <label className={lab}>{t("Kolor dodatkowy")}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={t("Kolor dodatkowy")}
              value={s.accent2}
              onChange={(e) => set({ accent2: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent"
            />
            <Input
              value={s.accent2}
              maxLength={7}
              onChange={(e) =>
                /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && set({ accent2: e.target.value })
              }
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={lab}>{t("Baner w nagłówku strony (opcjonalnie)")}</label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="min-w-60 flex-1"
              placeholder={t("https://…")}
              value={s.banner}
              onChange={(e) => set({ banner: e.target.value })}
            />
            <Button type="button" variant="outline" disabled={busy} asChild>
              <label className="cursor-pointer">
                <Upload className="size-4" />
                {busy ? t("Wysyłanie…") : t("Wgraj")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => void addBanner(e.target.files?.[0])}
                />
              </label>
            </Button>
            {s.banner && (
              <Button type="button" variant="ghost" onClick={() => set({ banner: "" })}>
                {t("Usuń")}
              </Button>
            )}
          </div>
          {error && <p className="mt-1 text-xs text-destructive">{t(error)}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={lab}>
            {t("Muzyka na stronie: link do playlisty Spotify lub YouTube (opcjonalnie)")}
          </label>
          <Input
            placeholder={t(
              "https://open.spotify.com/playlist/… albo https://www.youtube.com/playlist?list=…",
            )}
            value={s.music}
            maxLength={300}
            onChange={(e) => set({ music: e.target.value.trim() })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "Odwiedzający dostają przycisk 🎵 z oficjalnym odtwarzaczem (np. playlista Taco Hemingwaya, którą znajdziesz na Spotify lub YouTube). Muzyka nie włącza się sama – przeglądarki tego blokują, trzeba kliknąć „play”.",
            )}
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className={lab}>{t("Zaproszenie na Discord (przycisk „Dołącz”)")}</label>
          <Input
            placeholder="https://discord.gg/twoje-zaproszenie"
            value={s.discord}
            maxLength={200}
            onChange={(e) => set({ discord: e.target.value.trim() })}
          />
        </div>
        <div>
          <label className={lab}>{t("Minimalna długość odpowiedzi (znaki)")}</label>
          <Input
            type="number"
            min={0}
            max={500}
            value={s.minChars}
            onChange={(e) => set({ minChars: clamp(e.target.value, 0, 500) })}
          />
        </div>
        <div>
          <label className={lab}>{t("Blokada ponownego podania (godziny, 0 = brak)")}</label>
          <Input
            type="number"
            min={0}
            max={168}
            value={s.cooldownHours}
            onChange={(e) => set({ cooldownHours: clamp(e.target.value, 0, 168) })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={lab}>{t("Komunikat po wysłaniu podania")}</label>
          <Textarea
            value={s.successText}
            maxLength={300}
            rows={2}
            onChange={(e) => set({ successText: e.target.value })}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-bold">
            {t("Najczęstsze pytania (")}
            {s.faq.length}/{SITE_FAQ_MAX})
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={s.faq.length >= SITE_FAQ_MAX}
            onClick={() => set({ faq: [...s.faq, { q: "Nowe pytanie", a: "Odpowiedź" }] })}
          >
            <Plus className="size-4" /> {t("Dodaj")}
          </Button>
        </div>
        <div className="space-y-3">
          {s.faq.map((f, i) => (
            <div key={i} className="space-y-2 rounded-xl border bg-card p-3">
              <div className="flex gap-2">
                <Input
                  aria-label={t("Pytanie {v1}", { v1: i + 1 })}
                  value={f.q}
                  maxLength={120}
                  onChange={(e) =>
                    set({ faq: s.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("Usuń pytanie {v1}", { v1: i + 1 })}
                  onClick={() => set({ faq: s.faq.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Textarea
                aria-label={t("Odpowiedź {v1}", { v1: i + 1 })}
                rows={2}
                value={f.a}
                maxLength={500}
                onChange={(e) =>
                  set({ faq: s.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const clamp = (v: string, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
