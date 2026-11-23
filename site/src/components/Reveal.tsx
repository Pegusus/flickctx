"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger direct children when the block enters view */
  stagger?: boolean;
};

export function Reveal({ children, className = "", stagger = false }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("in");
      el.dataset.dir = "down";
      return;
    }

    let lastY = window.scrollY;
    let dir: "down" | "up" = "down";

    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) < 2) return;
      dir = y > lastY ? "down" : "up";
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            target.dataset.dir = dir;
            // Force a reflow so direction change applies before `.in`
            void target.offsetWidth;
            target.classList.add("in");
          } else {
            // Instant reset (no fade-out) so content stays readable while
            // scrolling past; next enter animates again from up or down.
            target.style.transition = "none";
            target.classList.remove("in");
            void target.offsetWidth;
            target.style.transition = "";
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.14 }
    );

    io.observe(el);
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={["reveal", stagger ? "reveal-stagger" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
