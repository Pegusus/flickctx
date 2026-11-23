"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Reveal({
  children,
  className = "",
  cascade = false,
}: {
  children: ReactNode;
  className?: string;
  /** Soft stagger for direct children */
  cascade?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={["reveal", cascade ? "reveal-cascade" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
