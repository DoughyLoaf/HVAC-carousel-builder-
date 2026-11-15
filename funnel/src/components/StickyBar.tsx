"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The phone-only action bar. It stays out of the way while the element matched
 * by `watch` (the hero's own buttons) is on screen, and shows once that scrolls
 * off. Without JavaScript it is simply always shown.
 */
export function StickyBar({ watch, children }: { watch: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const target = document.querySelector(watch);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), { threshold: 0.25 });
    io.observe(target);
    return () => io.disconnect();
  }, [watch]);
  return (
    <nav className="sticky-cta" aria-label="Quick actions" data-hidden={hidden}>
      {children}
    </nav>
  );
}
