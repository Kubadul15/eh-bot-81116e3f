import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ImagePlus,
  X,
  Eye,
  FileText,
  Paperclip,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import {
  EMBED_TYPES,
  TICKET_FORM_FIELDS,
  emptyEmbed,
  type ContentConfig,
  type EmbedConfig,
  type QuestionConfig,
} from "@/lib/content-config";
import { uploadImage, sendAnnouncement } from "@/lib/content.functions";
import type { Limits } from "@/lib/premium";
import { useI18n } from "@/lib/i18n-react";

type View = "recruitment" | "tickets" | "embeds";
type Props = {
  guildId: string;
  value: ContentConfig;
  onChange: (v: ContentConfig) => void;
  roles: { id: string; name: string }[];
  channels: { id: string; name: string; type: number }[];
  view: View;
  /** Limity planu serwera (Free/Premium); bez nich edytor używa twardych limitów Discorda. */
  limits?: Limits | undefined;
  /** Czy serwer może włączyć obrazki w formularzu ticketu (Premium albo nadane przez właściciela). */
  ticketImages?: boolean | undefined;
};

// Jeden edytor dla rekrutacji i ticketów: obie sekcje mają tę samą budowę (stanowiska/rodzaje, pytania, otwarte/zamknięte).
const COPY = {
  recruitment: {
    kicker: "Nabór",
    title: "Rekrutacja",
    open: "Rekrutacja otwarta",
    closed: "Rekrutacja zamknięta",
    openAria: "Otwórz rekrutację",
    items: "Stanowiska",
    item: "STANOWISKO",
    add: "Stanowisko",
    empty: "Brak stanowisk",
    nameLabel: "Nazwa stanowiska",
    roleLabel: "Ranga po przyjęciu",
    noRole: "Bez nadawania rangi",
    switchLabel: "Nabór",
    questions: "Pytania",
    formTitle: "Formularz zgłoszenia",
    embedKey: "rekrutacja",
    defaultTitle: "Rekrutacja — Emergency Hamburg",
    defaultText: (open: boolean) =>
      open ? "Wybierz stanowisko i wypełnij formularz." : "Rekrutacja jest aktualnie zamknięta.",
    previewItems: "Stanowiska",
  },
  tickets: {
    kicker: "Zgłoszenia",
    title: "Tickety",
    open: "Tickety otwarte",
    closed: "Tickety zamknięte",
    openAria: "Włącz tworzenie ticketów",
    items: "Rodzaje ticketów (menu wyboru)",
    item: "RODZAJ",
    add: "Rodzaj",
    empty: "Brak rodzajów – menu będzie puste",
    nameLabel: "Nazwa rodzaju",
    roleLabel: "Ranga obsługująca (pingowana i widzi ticket)",
    noRole: "Tylko ekipa serwera",
    switchLabel: "Przyjmuje zgłoszenia",
    questions: "Pola formularza",
    formTitle: "Formularz ticketu",
    embedKey: "tickety",
    defaultTitle: "🎫 Centrum Pomocy — Emergency Hamburg",
    defaultText: (open: boolean) =>
      open
        ? "Wybierz kategorię z listy, a utworzymy prywatny kanał."
        : "Tworzenie ticketów jest chwilowo wyłączone.",
    previewItems: "Kategorie",
  },
} as const;

export function ContentEditor({
  guildId,
  value,
  onChange,
  roles,
  channels,
  view,
  limits,
  ticketImages = false,
}: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState("rekrutacja");
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const upload = useServerFn(uploadImage);
  const send = useServerFn(sendAnnouncement);
  const [channelId, setChannelId] = useState("");
  const [sendState, setSendState] = useState("idle");

  const isTickets = view === "tickets";
  const hasSection = view !== "embeds";
  const raw = COPY[isTickets ? "tickets" : "recruitment"];
  // napisy interfejsu tłumaczymy, a domyślne treści wiadomości bota (defaultTitle/defaultText) zostają po polsku – tak trafią na Discorda
  const c = {
    ...raw,
    kicker: t(raw.kicker),
    title: t(raw.title),
    open: t(raw.open),
    closed: t(raw.closed),
    openAria: t(raw.openAria),
    items: t(raw.items),
    item: t(raw.item),
    add: t(raw.add),
    empty: t(raw.empty),
    nameLabel: t(raw.nameLabel),
    roleLabel: t(raw.roleLabel),
    noRole: t(raw.noRole),
    switchLabel: t(raw.switchLabel),
    questions: t(raw.questions),
    formTitle: t(raw.formTitle),
    previewItems: t(raw.previewItems),
  };
  const r = isTickets ? value.tickets : value.recruitment; // wspólne pola: open, positions, questions
  const changeSection = (patch: Partial<ContentConfig["recruitment"]>) =>
    onChange(
      isTickets
        ? { ...value, tickets: { ...value.tickets, ...patch } }
        : { ...value, recruitment: { ...value.recruitment, ...patch } },
    );
  const changeTickets = (patch: Partial<ContentConfig["tickets"]>) =>
    onChange({ ...value, tickets: { ...value.tickets, ...patch } });

  const maxItems = isTickets
    ? Math.min(25, limits?.ticketTypes ?? 25)
    : Math.min(8, limits?.recruitPositions ?? 8); // rekrutacja: maks. 8 stanowisk
  const maxQuestions = isTickets
    ? TICKET_FORM_FIELDS - (value.tickets.images ? 1 : 0)
    : Math.min(25, limits?.recruitQuestions ?? 25);

  // pytania: w ticketach wspólne pola formularza, w rekrutacji – osobna lista dla każdego stanowiska
  const [qPos, setQPos] = useState("");
  const recruitPositions = value.recruitment.positions;
  const activePos = isTickets
    ? undefined
    : (recruitPositions.find((p) => p.id === qPos) ?? recruitPositions[0]);
  const questions: QuestionConfig[] = isTickets
    ? value.tickets.questions
    : (activePos?.questions ?? []);
  const setQuestions = (next: QuestionConfig[]) => {
    if (isTickets) return changeTickets({ questions: next });
    if (!activePos) return;
    onChange({
      ...value,
      recruitment: {
        ...value.recruitment,
        positions: recruitPositions.map((x) =>
          x.id === activePos.id ? { ...x, questions: next } : x,
        ),
      },
    });
  };
  const copyQuestionsFrom = (id: string) => {
    const src = recruitPositions.find((x) => x.id === id);
    if (src?.questions)
      setQuestions(
        src.questions.slice(0, maxQuestions).map((q) => ({ ...q, id: `q_${crypto.randomUUID()}` })),
      );
  };

  const key = hasSection ? c.embedKey : selected;
  const embed = value.embeds[key] ?? emptyEmbed();
  const changeEmbed = (patch: Partial<EmbedConfig>) =>
    onChange({ ...value, embeds: { ...value.embeds, [key]: { ...embed, ...patch } } });
  async function addImage(file: File | undefined, field: "image" | "thumbnail") {
    if (!file) return;
    setUploading(field);
    setError("");
    try {
      const data = new FormData();
      data.set("guildId", guildId);
      data.set("file", file);
      const result = await upload({ data });
      changeEmbed({ [field]: result.url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać zdjęcia");
    } finally {
      setUploading(null);
    }
  }
  const moveQuestion = (index: number, direction: number) => {
    const next = [...questions];
    const target = index + direction;
    const current = next[index],
      other = next[target];
    if (!current || !other) return;
    next[index] = other;
    next[target] = current;
    setQuestions(next);
  };

  return (
    <div className="animate-fade-up">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {t("Emergency Hamburg /")} {hasSection ? c.kicker : t("Wiadomości")}
          </p>
          <h2 className="mt-1 font-display text-4xl">
            {hasSection ? c.title : t("Edytor embedów")}
          </h2>
        </div>
        {hasSection && (
          <label className="flex items-center gap-3 rounded-md border px-4 py-3 text-sm font-semibold">
            <span>{r.open ? c.open : c.closed}</span>
            <Switch
              aria-label={c.openAria}
              checked={r.open}
              onCheckedChange={(open) => changeSection({ open })}
            />
          </label>
        )}
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          {isTickets && (
            <section className="rounded-lg border bg-card p-4">
              <h3 className="text-lg font-semibold">{t("Ustawienia ticketów")}</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label={t("Maks. otwartych ticketów na osobę")}>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    aria-label={t("Maks. otwartych ticketów na osobę")}
                    value={value.tickets.maxOpen}
                    onChange={(e) =>
                      changeTickets({
                        maxOpen: Math.min(10, Math.max(1, Math.floor(Number(e.target.value) || 1))),
                      })
                    }
                  />
                </Field>
                <div className="mt-3 space-y-1.5">
                  <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm font-semibold">
                    <span className="flex items-center gap-2">
                      <Paperclip className="size-4" />
                      {t("Obrazki w formularzu")}
                    </span>
                    <Switch
                      aria-label={t("Obrazki w formularzu ticketu")}
                      checked={value.tickets.images}
                      disabled={
                        !ticketImages ||
                        (!value.tickets.images &&
                          value.tickets.questions.length >= TICKET_FORM_FIELDS)
                      }
                      onCheckedChange={(images) => changeTickets({ images })}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {!ticketImages
                      ? t(
                          "💎 Funkcja Premium (albo nadana Twojemu serwerowi przez właściciela bota).",
                        )
                      : value.tickets.questions.length >= TICKET_FORM_FIELDS &&
                          !value.tickets.images
                        ? t(
                            "Usuń jedno pytanie – formularz Discorda ma maks. {TICKET_FORM_FIELDS} pól, a jedno zajmie wgrywanie plików.",
                            { TICKET_FORM_FIELDS },
                          )
                        : t(
                            "Gracz dołączy do zgłoszenia do 3 zdjęć lub zrzutów ekranu; trafią do kanału ticketu.",
                          )}
                  </p>
                </div>
              </div>
            </section>
          )}

          {hasSection && (
            <>
              <section>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">
                    {c.items}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {r.positions.length}/{maxItems}
                    </span>
                  </h3>
                  <Button
                    variant="outline"
                    disabled={r.positions.length >= maxItems}
                    onClick={() =>
                      changeSection({
                        positions: [
                          ...r.positions,
                          {
                            id: `p_${crypto.randomUUID()}`,
                            label: isTickets ? "Nowy rodzaj" : "Nowe stanowisko",
                            emoji: "",
                            desc: "",
                            roleId: "",
                            open: true,
                            ...(isTickets ? {} : { questions: [] }),
                          },
                        ],
                      })
                    }
                  >
                    <Plus />
                    {c.add}
                  </Button>
                </div>
                {r.positions.length >= maxItems && limits && maxItems < (isTickets ? 25 : 8) && (
                  <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {t("💎 Limit Twojego planu:")} {maxItems}
                    {t(". Premium podnosi go do")} {isTickets ? 25 : 8}.
                  </p>
                )}
                {!r.positions.length && (
                  <div className="border-y py-8 text-center text-sm text-muted-foreground">
                    {c.empty}
                  </div>
                )}
                <div className="space-y-3">
                  {r.positions.map((p, index) => {
                    const change = (patch: Partial<typeof p>) =>
                      changeSection({
                        positions: r.positions.map((item, i) =>
                          i === index ? { ...item, ...patch } : item,
                        ),
                      });
                    return (
                      <div key={p.id} className="rounded-lg border bg-card p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {c.item} {index + 1}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs">
                              {p.open ? t("Otwarte") : t("Zamknięte")}
                            </span>
                            <Switch
                              aria-label={`${c.switchLabel} ${p.label}`}
                              checked={p.open}
                              onCheckedChange={(open) => change({ open })}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              title={t("Usuń")}
                              aria-label={t("Usuń pozycję {v1}", { v1: index + 1 })}
                              onClick={() =>
                                changeSection({
                                  positions: r.positions.filter((x) => x.id !== p.id),
                                })
                              }
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[70px_1fr]">
                          <Field label={t("Emoji")}>
                            <Input
                              maxLength={8}
                              value={p.emoji}
                              onChange={(e) => change({ emoji: e.target.value })}
                            />
                          </Field>
                          <Field label={c.nameLabel}>
                            <Input
                              maxLength={40}
                              value={p.label}
                              onChange={(e) => change({ label: e.target.value })}
                            />
                          </Field>
                        </div>
                        <Field label={t("Opis")}>
                          <Input
                            className="mt-1"
                            maxLength={80}
                            value={p.desc}
                            onChange={(e) => change({ desc: e.target.value })}
                          />
                        </Field>
                        <Field label={c.roleLabel}>
                          <select
                            className="editor-select"
                            value={p.roleId}
                            onChange={(e) => change({ roleId: e.target.value })}
                          >
                            <option value="">{c.noRole}</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {c.questions}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {questions.length}/{maxQuestions}
                    </span>
                  </h3>
                  <Button
                    variant="outline"
                    disabled={questions.length >= maxQuestions || (!isTickets && !activePos)}
                    onClick={() =>
                      setQuestions([
                        ...questions,
                        {
                          id: `q_${crypto.randomUUID()}`,
                          label: isTickets ? "Nowe pole" : "Nowe pytanie",
                          style: "short",
                          required: true,
                          placeholder: "",
                        },
                      ])
                    }
                  >
                    <Plus />
                    {isTickets ? t("Pole") : t("Pytanie")}
                  </Button>
                </div>
                {!isTickets && (
                  <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                    {recruitPositions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t(
                          "Najpierw dodaj stanowisko powyżej – każde stanowisko ma własne pytania (do",
                        )}{" "}
                        {maxQuestions}).
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={t("Pytania dla stanowiska")}>
                          <select
                            className="editor-select"
                            value={activePos?.id ?? ""}
                            onChange={(e) => setQPos(e.target.value)}
                          >
                            {recruitPositions.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.emoji ? `${x.emoji} ` : ""}
                                {x.label} ({x.questions?.length ?? 0})
                              </option>
                            ))}
                          </select>
                        </Field>
                        {recruitPositions.length > 1 && (
                          <Field label={t("Skopiuj pytania z innego stanowiska")}>
                            <select
                              className="editor-select"
                              value=""
                              onChange={(e) => e.target.value && copyQuestionsFrom(e.target.value)}
                            >
                              <option value="">{t("— wybierz, aby zastąpić listę kopią —")}</option>
                              {recruitPositions
                                .filter((x) => x.id !== activePos?.id)
                                .map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.emoji ? `${x.emoji} ` : ""}
                                    {x.label} ({x.questions?.length ?? 0})
                                  </option>
                                ))}
                            </select>
                          </Field>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {!questions.length && (
                  <div className="border-y py-8 text-center text-sm text-muted-foreground">
                    {isTickets ? t("Brak pól – ticket powstanie bez formularza") : t("Brak pytań")}
                  </div>
                )}
                <div className="space-y-3">
                  {questions.map((q, index) => {
                    const change = (patch: Partial<typeof q>) =>
                      setQuestions(
                        questions.map((item, i) => (i === index ? { ...item, ...patch } : item)),
                      );
                    return (
                      <div key={q.id} className="rounded-lg border bg-card p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {isTickets ? t("POLE") : t("PYTANIE")} {index + 1}
                          </span>
                          <div className="flex">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={index === 0}
                              aria-label={t("Pozycja {v1} w górę", { v1: index + 1 })}
                              title={t("W górę")}
                              onClick={() => moveQuestion(index, -1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={index === questions.length - 1}
                              aria-label={t("Pozycja {v1} w dół", { v1: index + 1 })}
                              title={t("W dół")}
                              onClick={() => moveQuestion(index, 1)}
                            >
                              <ArrowDown />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title={t("Usuń")}
                              aria-label={t("Usuń pole {v1}", { v1: index + 1 })}
                              onClick={() => setQuestions(questions.filter((x) => x.id !== q.id))}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                        <Field label={isTickets ? t("Nazwa pola") : t("Treść pytania")}>
                          <Textarea
                            rows={2}
                            maxLength={200}
                            value={q.label}
                            onChange={(e) => change({ label: e.target.value })}
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {q.label.length}
                            {t(
                              "/200 znaków. Na stronie rekrutacji widać całość, w oknie Discorda pierwsze ok. 145 znaków (reszta jest w aplikacji).",
                            )}
                          </p>
                        </Field>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Field label={t("Odpowiedź")}>
                            <select
                              className="editor-select"
                              value={q.style}
                              onChange={(e) =>
                                change({ style: e.target.value === "long" ? "long" : "short" })
                              }
                            >
                              <option value="short">{t("Krótka")}</option>
                              <option value="long">{t("Długa")}</option>
                            </select>
                          </Field>
                          <label className="flex items-center justify-between gap-3 text-sm">
                            {t("Wymagane")}
                            <Switch
                              checked={q.required}
                              aria-label={t("Pozycja {v1} wymagana", { v1: index + 1 })}
                              onCheckedChange={(required) => change({ required })}
                            />
                          </label>
                        </div>
                        <Field label={t("Podpowiedź w polu")}>
                          <Input
                            maxLength={100}
                            value={q.placeholder}
                            onChange={(e) => change({ placeholder: e.target.value })}
                          />
                        </Field>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <FileText className="size-4" />
              {t("Treść embeda")}
              {isTickets ? t(" panelu ticketów") : ""}
            </h3>
            {view === "embeds" && (
              <Field label={t("Wiadomość")}>
                <select
                  className="editor-select"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {EMBED_TYPES.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={t("Tytuł")}>
              <Input
                maxLength={256}
                value={embed.title}
                placeholder={hasSection ? c.defaultTitle : t("Domyślny tytuł bota")}
                onChange={(e) => changeEmbed({ title: e.target.value })}
              />
            </Field>
            <Field label={t("Opis")}>
              <Textarea
                rows={5}
                maxLength={2000}
                value={embed.description}
                placeholder={t("Domyślna treść bota")}
                onChange={(e) => changeEmbed({ description: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_90px]">
              <Field label={t("Stopka")}>
                <Input
                  maxLength={200}
                  value={embed.footer}
                  placeholder={t("Emergency Hamburg")}
                  onChange={(e) => changeEmbed({ footer: e.target.value })}
                />
              </Field>
              <Field label={t("Kolor")}>
                <Input
                  aria-label={t("Kolor embeda")}
                  type="color"
                  value={embed.color}
                  onChange={(e) => changeEmbed({ color: e.target.value })}
                />
              </Field>
            </div>
            {(["image", "thumbnail"] as const).map((field) => (
              <div key={field} className="space-y-2">
                <Field label={field === "image" ? t("Zdjęcie embeda") : t("Miniatura")}>
                  <Input
                    type="url"
                    value={embed[field]}
                    placeholder={t("https://…")}
                    onChange={(e) => changeEmbed({ [field]: e.target.value })}
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" disabled={!!uploading}>
                    <label>
                      <ImagePlus />
                      {uploading === field ? t("Dodawanie…") : t("Dodaj zdjęcie")}
                      <input
                        className="sr-only"
                        aria-label={
                          field === "image" ? t("Wgraj zdjęcie embeda") : t("Wgraj miniaturę")
                        }
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        disabled={!!uploading}
                        onChange={(e) => {
                          void addImage(e.target.files?.[0], field);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </Button>
                  {embed[field] && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("Usuń {field}", { field })}
                      title={t("Usuń zdjęcie")}
                      onClick={() => changeEmbed({ [field]: "" })}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {t(error)}
              </p>
            )}
            {view === "embeds" && selected === "embed" && (
              <div className="space-y-3 border-t pt-4">
                <Field label={t("Kanał ogłoszenia")}>
                  <select
                    className="editor-select"
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                  >
                    <option value="">{t("Wybierz kanał")}</option>
                    {channels
                      .filter((ch) => ch.type !== 4)
                      .map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          # {ch.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Button
                  disabled={!channelId || sendState === "sending"}
                  onClick={async () => {
                    setSendState("sending");
                    setError("");
                    try {
                      await send({ data: { guildId, channelId, embed } });
                      setSendState("sent");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Błąd wysyłania");
                      setSendState("idle");
                    }
                  }}
                >
                  {sendState === "sending"
                    ? t("Wysyłanie…")
                    : sendState === "sent"
                      ? t("Wysłano")
                      : t("Wyślij ogłoszenie")}
                </Button>
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-6">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <Eye className="size-4" />
            {t("Podgląd")}
          </div>
          <div className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {t("EH")}
              </span>
              <div className="text-sm font-semibold">
                {t("Emergency Hamburg")}{" "}
                <span className="ml-1 rounded bg-secondary px-1 text-xs text-muted-foreground">
                  {t("BOT")}
                </span>
              </div>
            </div>
            <div
              className="embed-preview min-w-0 border-l-4 bg-secondary/60 p-4"
              ref={(el) => {
                if (el) el.style.borderLeftColor = embed.color;
              }}
            >
              {embed.thumbnail && (
                <img
                  src={embed.thumbnail}
                  alt={t("Miniatura")}
                  className="float-right ml-3 size-14 rounded object-cover"
                />
              )}
              <h4 className="break-words font-semibold">
                {embed.title ||
                  (hasSection ? c.defaultTitle : EMBED_TYPES.find(([id]) => id === selected)?.[1])}
              </h4>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {embed.description ||
                  (hasSection ? c.defaultText(r.open) : t("Domyślna treść bota"))}
              </p>
              {hasSection && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">{c.previewItems}</p>
                  {r.positions.map((p) => (
                    <div key={p.id} className="text-sm">
                      <span className="font-semibold">
                        {p.emoji} {p.label}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.open && p.open ? t("Otwarte") : t("Zamknięte")}
                      </span>
                      {p.desc && <p className="text-xs text-muted-foreground">{p.desc}</p>}
                    </div>
                  ))}
                </div>
              )}
              {embed.image && (
                <img
                  src={embed.image}
                  alt={t("Zdjęcie embeda")}
                  className="mt-4 aspect-video w-full rounded object-cover"
                />
              )}
              <p className="mt-4 clear-both text-xs text-muted-foreground">
                {embed.footer || t("Emergency Hamburg")}
              </p>
            </div>
            {hasSection && (questions.length > 0 || (isTickets && value.tickets.images)) && (
              <div className="mt-6 border-t pt-5">
                <h4 className="mb-4 text-sm font-semibold">{c.formTitle}</h4>
                <div className="space-y-4">
                  {questions.map((q) => (
                    <div key={q.id}>
                      <p className="mb-1 break-words text-xs font-semibold">
                        {q.label}
                        {q.required ? " *" : ""}
                      </p>
                      {q.style === "long" ? (
                        <Textarea disabled placeholder={q.placeholder} />
                      ) : (
                        <Input disabled placeholder={q.placeholder} />
                      )}
                    </div>
                  ))}
                  {isTickets && value.tickets.images && (
                    <div>
                      <p className="mb-1 text-xs font-semibold">{t("Obrazki (opcjonalnie)")}</p>
                      <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
                        <Paperclip className="size-4" />
                        {t("Przeciągnij lub wybierz do 3 zdjęć")}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
