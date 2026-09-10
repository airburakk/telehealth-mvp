"use client";

import { useEffect } from "react";
import { isLandingPlacement } from "@/lib/doctorium-landing/events";
import { track } from "./track";

// Sayfa-düzeyi event'ler: landing_view (ilk render, bir kez) + section_view (her bölüm %50
// görünürlüğe ilk girişte bir kez). Payload yalnız bölüm id'si (kategori). Hydration'dan
// sonra çalışır; observer yoksa sessizce hiçbir şey yapmaz.
// v6.262: control/transparency bölümleri kalktı (yerleşimleri allowlist'te tarihsel); students → "ogrenci".
const SECTION_PLACEMENT: Record<string, string> = {
  hero: "hero", problem: "problem", manifesto: "manifesto", personalize: "kisisellestir", legal: "hukuk", today: "bugun",
  academic: "akademik", congress: "kongre", regulatory: "regulasyon", students: "ogrenci", identity: "identity",
  difference: "fark", "get-started": "basla",
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
