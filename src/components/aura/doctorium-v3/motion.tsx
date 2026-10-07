"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Decorative, once-per-entry fade uses the browser animation API. Content stays
// visible in server HTML, without JS, and when motion/observer APIs are unavailable.
export function FadeInUp({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined" || typeof node.animate !== "function") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    let played = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || reduce.matches || played) return;
      played = true;
      animation = node.animate([
        { opacity: 0, transform: "translateY(16px)" },
        { opacity: 1, transform: "translateY(0px)" },
      ], { duration: 400, delay: Math.max(0, delay) * 1000, easing: "cubic-bezier(0.32,0.72,0,1)", fill: "both" });
      observer.unobserve(node);
    }, { rootMargin: "-80px", threshold: 0 });
    const preferenceChanged = () => {
      if (reduce.matches) { animation?.cancel(); observer.disconnect(); }
      else if (!played) observer.observe(node);
    };
    if (!reduce.matches) observer.observe(node);
    reduce.addEventListener("change", preferenceChanged);
    return () => { observer.disconnect(); animation?.cancel(); reduce.removeEventListener("change", preferenceChanged); };
  }, [delay]);
  return <div ref={ref} className={className}>{children}</div>;
}
