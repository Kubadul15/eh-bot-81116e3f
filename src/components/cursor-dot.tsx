import { useEffect, useRef } from "react";

// Własny kursor: pętla animacji działa tylko wtedy, gdy kursor się porusza (po zatrzymaniu się wygasza), więc w bezruchu nie obciąża strony.
export function CursorDot() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    document.documentElement.classList.add("has-dot");
    let x = 0,
      y = 0,
      rx = 0,
      ry = 0,
      raf = 0,
      running = false,
      lastTarget: Element | null = null,
      hover = false;
    const tick = () => {
      rx += (x - rx) * 0.22;
      ry += (y - ry) * 0.22;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px,${y}px,0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      if (Math.abs(x - rx) > 0.15 || Math.abs(y - ry) > 0.15) raf = requestAnimationFrame(tick);
      else running = false;
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      // sprawdzanie „czy nad przyciskiem” tylko gdy kursor wjechał na inny element (closest przy każdym ruchu jest kosztowne)
      const t = e.target as Element | null;
      if (t !== lastTarget) {
        lastTarget = t;
        const h = !!t?.closest?.("a,button,select,input,label,summary,textarea");
        if (h !== hover) {
          hover = h;
          ring.current?.classList.toggle("is-hover", h);
        }
      }
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("has-dot");
    };
  }, []);
  return (
    <>
      <div ref={ring} className="cursor-ring" aria-hidden />
      <div ref={dot} className="cursor-dot" aria-hidden />
    </>
  );
}
