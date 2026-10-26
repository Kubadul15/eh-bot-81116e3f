import { useEffect, useState } from "react";
import { musicEmbed } from "@/lib/rk-embed";
import { useI18n } from "@/lib/i18n-react";

const KEY = "rk-theme";
export type RkTheme = "dark" | "light";

/** Motyw (ciemny/jasny) stron rekrutacji: zapamiętany w przeglądarce; ustawia się na <html>, żeby objął całą stronę. */
export function useRkTheme() {
  const [theme, setTheme] = useState<RkTheme>("dark");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
      else if (window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");
    } catch {
      /* pamięć przeglądarki niedostępna */
    }
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset["rkTheme"] = theme;
    return () => {
      delete root.dataset["rkTheme"];
    };
  }, [theme]);
  // animacje wejścia: elementy z klasą rk-reveal pojawiają się przy przewijaniu (także te dodane później, np. po wczytaniu danych)
  useEffect(() => {
    const root = document.documentElement;
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    root.classList.add("rk-anim");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    const watch = (el: Element) => {
      if (el.hasAttribute("data-rk-seen") || el.classList.contains("is-in")) return;
      el.setAttribute("data-rk-seen", "");
      io.observe(el);
    };
    const scan = (root: ParentNode) => root.querySelectorAll(".rk-reveal").forEach(watch);
    scan(document);
    // nowe elementy (np. po wczytaniu danych): sprawdzamy tylko dodane węzły, a nie całą stronę przy każdej zmianie
    const mo = new MutationObserver((records) => {
      for (const r of records)
        r.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.classList.contains("rk-reveal")) watch(n);
          scan(n);
        });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      root.classList.remove("rk-anim");
    };
  }, []);
  const toggle = () =>
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignorujemy */
      }
      return next;
    });
  return { theme, toggle };
}

/** Pływający pasek: przełącznik motywu i (opcjonalnie) odtwarzacz muzyki z playlisty ustawionej przez właściciela serwera. */
export function RkTools({ music }: { music?: string }) {
  const { t: tr } = useI18n();
  const { theme, toggle } = useRkTheme();
  const embed = music ? musicEmbed(music) : null;
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false); // odtwarzacz ładujemy dopiero po pierwszym otwarciu i zostawiamy, żeby muzyka grała po zwinięciu
  const btn =
    "grid size-11 place-items-center rounded-full border border-[var(--rk-line)] bg-[var(--rk-field)] text-lg shadow-lg transition hover:scale-105";
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {embed && started && (
        <div
          className={`${open ? "" : "hidden"} w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-[var(--rk-line)] bg-[var(--rk-field)] shadow-2xl`}
        >
          <iframe
            title={tr("Muzyka")}
            src={embed.src}
            width="100%"
            height={embed.height}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="block border-0"
          />
        </div>
      )}
      <div className="flex gap-2">
        {embed && (
          <button
            type="button"
            className={btn}
            aria-label={open ? tr("Ukryj odtwarzacz muzyki") : tr("Pokaż odtwarzacz muzyki")}
            aria-pressed={open}
            title={tr("Muzyka")}
            onClick={() => {
              setStarted(true);
              setOpen((o) => !o);
            }}
          >
            🎵
          </button>
        )}
        <button
          type="button"
          className={btn}
          aria-label={theme === "dark" ? tr("Włącz jasny motyw") : tr("Włącz ciemny motyw")}
          title={theme === "dark" ? tr("Jasny motyw") : tr("Ciemny motyw")}
          onClick={toggle}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </div>
  );
}
