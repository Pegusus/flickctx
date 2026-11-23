"use client";

import { useEffect, useState } from "react";
import styles from "./SiteHeader.module.css";

const LINKS = [
  { href: "#how", label: "How", mobile: false },
  { href: "#sessions", label: "Sessions", mobile: false },
  { href: "#config", label: "Config", mobile: false },
  { href: "#install", label: "Install", mobile: true },
  {
    href: "https://github.com/Pegusus/flickctx",
    label: "GitHub",
    mobile: true,
    external: true,
  },
];

export function SiteHeader() {
  const [active, setActive] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const ids = ["how", "sessions", "vision", "skills", "tools", "config", "install"];
    const els = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.4] }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onScroll = () => {
      if (reduce.matches) {
        setProgress(0);
        return;
      }
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <header className={styles.mast}>
      <div
        className={styles.progress}
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden
      />
      <div className={styles.inner}>
        <a className={styles.logo} href="./">
          Flick<span>ctx</span>
        </a>
        <nav className={styles.nav} aria-label="Primary">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={[
                !link.mobile ? styles.hideMobile : "",
                active === link.href ? styles.active : "",
              ]
                .filter(Boolean)
                .join(" ")}
              {...(link.external
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
