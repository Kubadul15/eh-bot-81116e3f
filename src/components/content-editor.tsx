import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, ArrowUp, ArrowDown, ImagePlus, X, Eye, FileText } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { EMBED_TYPES, emptyEmbed, type ContentConfig, type EmbedConfig } from "@/lib/content-config";
import { uploadImage } from "@/lib/content.functions";

type Props = { guildId: string; value: ContentConfig; onChange: (v: ContentConfig) => void; roles: { id: string; name: string }[]; view: "recruitment" | "embeds" };
export function ContentEditor({ guildId, value, onChange, roles, view }: Props) {
  const [selected, setSelected] = useState("rekrutacja");
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const upload = useServerFn(uploadImage);
  const r = value.recruitment;
  const changeRecruit = (patch: Partial<typeof r>) => onChange({ ...value, recruitment: { ...r, ...patch } });
  const key = view === "recruitment" ? "rekrutacja" : selected;
  const embed = value.embeds[key] ?? emptyEmbed();
  const changeEmbed = (patch: Partial<EmbedConfig>) => onChange({ ...value, embeds: { ...value.embeds, [key]: { ...embed, ...patch } } });
  async function addImage(file: File | undefined, field: "image" | "thumbnail") {
    if (!file) return;
    setUploading(field); setError("");
    try { const data = new FormData(); data.set("guildId", guildId); data.set("file", file); const result = await upload({ data }); changeEmbed({ [field]: result.url }); }
    catch (e) { setError(e instanceof Error ? e.message : "Nie udało się dodać zdjęcia"); }
    finally { setUploading(null); }
  }
  const moveQuestion = (index: number, direction: number) => { const next = [...r.questions]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; changeRecruit({ questions: next }); };
  return <div className="animate-fade-up">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-6">
      <div><p className="text-xs font-semibold uppercase text-muted-foreground">Emergency Hamburg / {view === "recruitment" ? "Nabór" : "Wiadomości"}</p><h2 className="mt-1 font-display text-4xl">{view === "recruitment" ? "Rekrutacja" : "Edytor embedów"}</h2></div>
      {view === "recruitment" && <label className="flex items-center gap-3 rounded-md border px-4 py-3 text-sm font-semibold"><span>{r.open ? "Rekrutacja otwarta" : "Rekrutacja zamknięta"}</span><Switch aria-label="Otwórz rekrutację" checked={r.open} onCheckedChange={open => changeRecruit({ open })} /></label>}
    </div>
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-8">
        {view === "recruitment" && <>
          <section><div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">Stanowiska <span className="text-sm font-normal text-muted-foreground">{r.positions.length}/25</span></h3><Button variant="outline" disabled={r.positions.length >= 25} onClick={() => changeRecruit({ positions: [...r.positions, { id: `p_${crypto.randomUUID()}`, label: "Nowe stanowisko", emoji: "", desc: "", roleId: "", open: true }] })}><Plus />Stanowisko</Button></div>
            {!r.positions.length && <div className="border-y py-8 text-center text-sm text-muted-foreground">Brak stanowisk</div>}
            <div className="space-y-3">{r.positions.map((p, index) => {
              const change = (patch: Partial<typeof p>) => changeRecruit({ positions: r.positions.map((item, i) => i === index ? { ...item, ...patch } : item) });
              return <div key={p.id} className="rounded-lg border bg-card p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">STANOWISKO {index + 1}</span><div className="flex items-center gap-3"><span className="text-xs">{p.open ? "Otwarte" : "Zamknięte"}</span><Switch aria-label={`Nabór ${p.label}`} checked={p.open} onCheckedChange={open => change({ open })} /><Button size="icon" variant="ghost" title="Usuń stanowisko" aria-label={`Usuń stanowisko ${index + 1}`} onClick={() => changeRecruit({ positions: r.positions.filter(x => x.id !== p.id) })}><Trash2 /></Button></div></div>
                <div className="grid gap-3 sm:grid-cols-[70px_1fr]"><Field label="Emoji"><Input maxLength={8} value={p.emoji} onChange={e => change({ emoji: e.target.value })} /></Field><Field label="Nazwa stanowiska"><Input maxLength={40} value={p.label} onChange={e => change({ label: e.target.value })} /></Field></div>
                <Field label="Opis"><Input className="mt-1" maxLength={80} value={p.desc} onChange={e => change({ desc: e.target.value })} /></Field>
                <Field label="Ranga po przyjęciu"><select className="editor-select" value={p.roleId} onChange={e => change({ roleId: e.target.value })}><option value="">Bez nadawania rangi</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field>
              </div>;
            })}</div>
          </section>
          <section><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Pytania <span className="text-sm font-normal text-muted-foreground">{r.questions.length}/15</span></h3><Button variant="outline" disabled={r.questions.length >= 15} onClick={() => changeRecruit({ questions: [...r.questions, { id: `q_${crypto.randomUUID()}`, label: "Nowe pytanie", style: "short", required: true, placeholder: "" }] })}><Plus />Pytanie</Button></div>
            {!r.questions.length && <div className="border-y py-8 text-center text-sm text-muted-foreground">Brak pytań</div>}
            <div className="space-y-3">{r.questions.map((q, index) => {
              const change = (patch: Partial<typeof q>) => changeRecruit({ questions: r.questions.map((item, i) => i === index ? { ...item, ...patch } : item) });
              return <div key={q.id} className="rounded-lg border bg-card p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">PYTANIE {index + 1}</span><div className="flex"><Button size="icon" variant="ghost" disabled={index === 0} aria-label={`Pytanie ${index + 1} w górę`} title="W górę" onClick={() => moveQuestion(index, -1)}><ArrowUp /></Button><Button size="icon" variant="ghost" disabled={index === r.questions.length - 1} aria-label={`Pytanie ${index + 1} w dół`} title="W dół" onClick={() => moveQuestion(index, 1)}><ArrowDown /></Button><Button size="icon" variant="ghost" title="Usuń pytanie" aria-label={`Usuń pytanie ${index + 1}`} onClick={() => changeRecruit({ questions: r.questions.filter(x => x.id !== q.id) })}><Trash2 /></Button></div></div>
                <Field label="Treść pytania"><Input maxLength={45} value={q.label} onChange={e => change({ label: e.target.value })} /></Field><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Odpowiedź"><select className="editor-select" value={q.style} onChange={e => change({ style: e.target.value === "long" ? "long" : "short" })}><option value="short">Krótka</option><option value="long">Długa</option></select></Field><label className="flex items-center justify-between gap-3 text-sm">Wymagane<Switch checked={q.required} aria-label={`Pytanie ${index + 1} wymagane`} onCheckedChange={required => change({ required })} /></label></div><Field label="Podpowiedź w polu"><Input maxLength={100} value={q.placeholder} onChange={e => change({ placeholder: e.target.value })} /></Field>
              </div>;
            })}</div>
          </section>
        </>}
        <section className="space-y-4"><h3 className="flex items-center gap-2 text-lg font-semibold"><FileText className="size-4" />Treść embeda</h3>
          {view === "embeds" && <Field label="Wiadomość"><select className="editor-select" value={selected} onChange={e => setSelected(e.target.value)}>{EMBED_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>}
          <Field label="Tytuł"><Input maxLength={256} value={embed.title} placeholder={view === "recruitment" ? "Rekrutacja — Emergency Hamburg" : "Domyślny tytuł bota"} onChange={e => changeEmbed({ title: e.target.value })} /></Field>
          <Field label="Opis"><Textarea rows={5} maxLength={2000} value={embed.description} placeholder="Domyślna treść bota" onChange={e => changeEmbed({ description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_90px]"><Field label="Stopka"><Input maxLength={200} value={embed.footer} placeholder="Emergency Hamburg" onChange={e => changeEmbed({ footer: e.target.value })} /></Field><Field label="Kolor"><Input aria-label="Kolor embeda" type="color" value={embed.color} onChange={e => changeEmbed({ color: e.target.value })} /></Field></div>
          {(["image", "thumbnail"] as const).map(field => <div key={field} className="space-y-2"><Field label={field === "image" ? "Zdjęcie embeda" : "Miniatura"}><Input type="url" value={embed[field]} placeholder="https://…" onChange={e => changeEmbed({ [field]: e.target.value })} /></Field><div className="flex items-center gap-2"><Button asChild variant="outline" disabled={!!uploading}><label><ImagePlus />{uploading === field ? "Dodawanie…" : "Dodaj zdjęcie"}<input className="sr-only" aria-label={field === "image" ? "Wgraj zdjęcie embeda" : "Wgraj miniaturę"} type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={!!uploading} onChange={e => { void addImage(e.target.files?.[0], field); e.target.value = ""; }} /></label></Button>{embed[field] && <Button variant="ghost" size="icon" aria-label={`Usuń ${field}`} title="Usuń zdjęcie" onClick={() => changeEmbed({ [field]: "" })}><X /></Button>}</div></div>)}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </section>
      </div>
      <aside className="min-w-0 xl:sticky xl:top-6"><div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Eye className="size-4" />Podgląd</div><div className="rounded-lg border bg-card p-5"><div className="mb-4 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">EH</span><div className="text-sm font-semibold">Emergency Hamburg <span className="ml-1 rounded bg-secondary px-1 text-xs text-muted-foreground">BOT</span></div></div><div className="embed-preview min-w-0 border-l-4 bg-secondary/60 p-4" ref={el => { if (el) el.style.borderLeftColor = embed.color; }}>
        {embed.thumbnail && <img src={embed.thumbnail} alt="Miniatura" className="float-right ml-3 size-14 rounded object-cover" />}
        <h4 className="break-words font-semibold">{embed.title || (view === "recruitment" ? "Rekrutacja — Emergency Hamburg" : EMBED_TYPES.find(([id]) => id === selected)?.[1])}</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{embed.description || (view === "recruitment" ? r.open ? "Wybierz stanowisko i wypełnij formularz." : "Rekrutacja jest aktualnie zamknięta." : "Domyślna treść bota")}</p>
        {view === "recruitment" && <div className="mt-4 space-y-2"><p className="text-sm font-semibold">Stanowiska</p>{r.positions.map(p => <div key={p.id} className="text-sm"><span className="font-semibold">{p.emoji} {p.label}</span><span className="ml-2 text-xs text-muted-foreground">{r.open && p.open ? "Otwarte" : "Zamknięte"}</span>{p.desc && <p className="text-xs text-muted-foreground">{p.desc}</p>}</div>)}</div>}
        {embed.image && <img src={embed.image} alt="Zdjęcie embeda" className="mt-4 aspect-video w-full rounded object-cover" />}<p className="mt-4 clear-both text-xs text-muted-foreground">{embed.footer || "Emergency Hamburg"}</p>
      </div></div>
      {view === "recruitment" && r.questions.length > 0 && <div className="mt-6 border-t pt-5"><h4 className="mb-4 text-sm font-semibold">Formularz zgłoszenia</h4><div className="space-y-4">{r.questions.map(q => <div key={q.id}><p className="mb-1 break-words text-xs font-semibold">{q.label}{q.required ? " *" : ""}</p>{q.style === "long" ? <Textarea disabled placeholder={q.placeholder} /> : <Input disabled placeholder={q.placeholder} />}</div>)}</div></div>}
      </aside>
    </div>
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mt-3 block space-y-1.5"><span className="text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>; }