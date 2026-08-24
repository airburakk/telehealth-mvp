"use client";

import { useEffect } from "react";
import { isLandingPlacement } from "@/lib/doctorium-landing/events";
import { track } from "./track";

// Sayfa-düzeyi event'ler: landing_view (ilk render, bir kez) + section_view (her bölüm %50
// görünürlüğe ilk girişte bir kez). Payload yalnız bölüm id'si (kategori). Hydration'dan
// sonra çalışır; observer yoksa sessizce hiçbir şey yapmaz.
const SECTION_PLACEMENT: Record<string, string> = {
  hero: "hero", problem: "problem", manifesto: "manifesto", personalize: "kisisellestir", today: "bugun",
  academic: "akademik", regulatory: "regulasyon", legal: "hukuk", congress: "kongre", identity: "identity",
  control: "kontrol", transparency: "guven", difference: "fark", "get-started": "basla",
};

export function LandingEventBeacon() {
  useEffect(() => {
    track("landing_view", "none");
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Set<string>();
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const id = (en.target as HTMLElement).dataset.section;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const p = SECTION_PLACEMENT[id];
        if (isLandingPlacement(p)) track("section_view", p);
        io.unobserve(en.target);
      }
    }, { threshold: 0.5 });
    document.querySelectorAll<HTMLElement>("section[data-section]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
