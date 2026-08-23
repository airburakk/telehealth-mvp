"use client";

import { useEffect, useRef, useState } from "react";
import type { LandingSample } from "@/lib/doctorium-landing/landing-feed";
import {
  LANDING_BRANCHES, LANDING_MODULES, landingBranchLabel, type LandingModuleKey,
} from "@/lib/doctorium-landing/taxonomy";
import { pickOnePerModule } from "@/lib/doctorium-landing/pick";
import { FeedPreview } from "./FeedPreview";
import { ProductFrame } from "./ProductFrame";
import { track } from "./track";

// Kişiselleştirme DEMOSU (DOCV2-032): seçim → deterministik önizleme. İZOLE: hiçbir profile/
// preferences ucuna yazmaz, URL'e/localStorage'a yazmaz, analytics'e ham seçimi göndermez
// (yalnız "demo_start"/"demo_update" + kategori). Veri: /api/doctorium/landing-feed (anonim,
// salt-okunur). İlk boyama sunucudan gelen `initial` ile (boş ekran yok); hata → son başarılı
// liste korunur + hata satırı. Klavye: native <select> + aria-pressed düğmeler; aria-live ölçülü
// (yalnız "Akış güncellendi: N kart", kart metni tekrar okunmaz).
type Sample = Omit<LandingSample, "items"> & { items: LandingSample["items"] };

function revive(raw: LandingSample): Sample {
  return { ...raw, items: raw.items.map((i) => ({ ...i, publishedAt: new Date(i.publishedAt) })) };
}

export function PersonalizationDemo({ initial }: { initial: LandingSample }) {
  const [branch, setBranch] = useState(initial.branch);
  const [modules, setModules] = useState<LandingModuleKey[]>(initial.modules);
  const [sample, setSample] = useState<Sample>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const started = useRef(false);
  const first = useRef(true);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ b: branch, m: modules.join(",") });
        const res = await fetch(`/api/doctorium/landing-feed?${qs}`, { signal: ac.signal });
        if (!res.ok) throw new Error(String(res.status));
        const next = revive((await res.json()) as LandingSample);
        setSample(next);
        setLive(`Akış güncellendi: ${next.items.length} kart`);
        track("personalization_demo_update", "demo");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("Önizleme şu an güncellenemedi; son görünüm korunuyor.");
        track("landing_error_shown", "demo");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [branch, modules]);

  const markStart = () => {
    if (started.current) return;
    started.current = true;
    track("personalization_demo_start", "demo");
  };

  const toggleModule = (k: LandingModuleKey) => {
    markStart();
    setModules((m) => {
      if (m.includes(k)) return m.length > 1 ? m.filter((x) => x !== k) : m; // son bölüm kapatılamaz
      return [...m, k];
    });
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div className="grid min-w-0 gap-4 rounded-2xl border border-[var(--dl-line)] bg-[var(--dl-panel)] p-5">
        <label className="grid gap-1.5">
          <span className="aura-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--dl-emerald)]">01 · Uzmanlığınız</span>
          <select
            value={branch}
            onChange={(e) => { markStart(); setBranch(e.target.value); }}
            className="w-full min-w-0 min-h-[44px] rounded-xl border border-[var(--dl-line)] bg-[var(--dl-bg)] px-3 text-[15px] text-[var(--dl-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-emerald)]"
          >
            {LANDING_BRANCHES.map((b) => (
              <option key={b.slug} value={b.slug}>{b.label}</option>
            ))}
          </select>
        </label>
        <fieldset className="grid gap-1.5">
          <legend className="aura-mono mb-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--dl-emerald)]">02 · Bölümleriniz</legend>
          <div className="flex flex-wrap gap-2">
            {LANDING_MODULES.map((m) => {
              const on = modules.includes(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleModule(m.key)}
                  className={`min-h-[40px] rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-emerald)] ${
                    on
                      // Metin = bölüm zemini: açıkta beyaz/#047857 (5.5:1), koyuda #0d0e10/#34d399 (9:1) — axe bulgusu 2026-08-23
                      ? "border-[var(--dl-emerald)] bg-[var(--dl-emerald)] text-[var(--dl-bg)]"
                      : "border-[var(--dl-line)] text-[var(--dl-body)] hover:border-[var(--dl-emerald)]/60"
                  }`}
                >
                  <span aria-hidden className="mr-1.5">{on ? "✓" : "+"}</span>{m.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div aria-busy={loading} className={loading ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}>
        <ProductFrame
          title="Akışım"
          meta={sample.source === "fixture" ? `${landingBranchLabel(branch)} · örnek içerik` : landingBranchLabel(branch)}
        >
          {/* QA DESK-07: en fazla 3 güçlü kart, tür çeşitliliğiyle; branş-eşleşmeli olanlar önde. */}
          <FeedPreview items={pickOnePerModule(sample.items, branch, 3)} branch={branch} why />
        </ProductFrame>
      </div>
      <p aria-live="polite" className="sr-only">{live}</p>
      {error && <p role="status" className="text-[13px] text-[var(--dl-rose)]">{error}</p>}
    </div>
  );
}
