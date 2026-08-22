// Doctorium landing V2 — REGISTRY ↔ İÇERİK sözleşme testi (2026-08-23, DOCV2-002/DOCV2-070).
//
// Neden: pazarlama metni ürünün önüne geçmesin. Her bölüm yalnız `verified`/`partial` capability'ye
// dayanır; registry'deki yasak kalıplar (EMA/TİTCK adı, "ilgi alanı", "akredite", ölçülmemiş süre…)
// hiçbir metinde (meta/OG dahil) geçmez; taksonomi kopyası (istemci-güvenli) sunucu kaynağıyla
// BİREBİR; analytics sözlüğü kapalı küme. Emsal: nav.test.ts TAM-liste + aura-landing-copy shape().
import { describe, it, expect } from "vitest";
import {
  SECTIONS, LANDING_META, HERO_PROOF_LINE, PROBLEM_SOURCES, REGULATORY_SOURCES, DIFFERENCE_ROWS,
} from "@/lib/doctorium-landing/content";
import { CAPABILITIES, canShowAll, capability, allProhibitedClaims } from "@/lib/doctorium-landing/capabilities";
import { LANDING_ANCHORS, LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { LANDING_BRANCHES, LANDING_MODULES, DEFAULT_DEMO_BRANCH, DEFAULT_DEMO_MODULES } from "@/lib/doctorium-landing/taxonomy";
import { isLandingEventName, isLandingPlacement, LANDING_EVENT_NAMES } from "@/lib/doctorium-landing/events";
import { whyShown } from "@/lib/doctorium-landing/why";
import { FIXTURE_FEED } from "@/lib/doctorium-landing/fixtures";
import { BRANCH_OPTIONS, FEED_MODULE_OPTIONS } from "@/lib/doctorium";

/** Tüm görünür + meta metinler tek listede (iddia taraması için). */
function allCopy(): string[] {
  const out: string[] = [];
  for (const s of SECTIONS) {
    out.push(s.title, s.eyebrow ?? "", s.lead ?? "", s.body ?? "", s.note ?? "");
    for (const it of s.items ?? []) out.push(it.k ?? "", it.t, it.b ?? "");
    for (const c of s.ctas ?? []) out.push(c.label);
  }
  out.push(...Object.values(LANDING_META), ...HERO_PROOF_LINE, ...REGULATORY_SOURCES);
  for (const p of PROBLEM_SOURCES) out.push(p.k, p.sources);
  for (const r of DIFFERENCE_ROWS) out.push(r.portal, r.doctorium);
  return out.filter(Boolean);
}

describe("registry", () => {
  it("her kayıt kanıt taşır; verified/partial kayıtların izinli iddiası var", () => {
    for (const c of CAPABILITIES) {
      expect(c.evidence.length, c.id).toBeGreaterThan(0);
      if (c.status === "verified" || c.status === "partial") {
        // analytics.aggregate landing metni taşımaz — tek istisna
        if (c.id !== "analytics.aggregate") expect(c.allowedClaims.length, c.id).toBeGreaterThan(0);
      }
    }
  });

  it("EMA · TİTCK · ilgi alanı · sıklık · ülke · kaynak seçimi · AI provenance · kritik sınıf = unsupported (kod kanıtı yok)", () => {
    for (const id of ["regulatory.ema", "regulatory.titck", "prefs.interests", "prefs.frequency", "prefs.country", "prefs.sources", "transparency.ai_provenance", "regulatory.severity"] as const) {
      expect(capability(id).status, id).toBe("unsupported");
    }
  });
});

describe("içerik ↔ registry", () => {
  it("S1+S2 tüm bölümler gösterilebilir — bir capability düşerse bu test GÜRÜLTÜLÜ kırılır", () => {
    for (const s of SECTIONS) expect(canShowAll(s.requires), s.id).toBe(true);
  });

  it("yasak kalıplar hiçbir metinde geçmez (registry prohibitedClaims + terim/iddia kuralları)", () => {
    const texts = allCopy();
    const lower = texts.map((t) => t.toLocaleLowerCase("tr-TR"));
    const banned = [
      ...allProhibitedClaims().map((p) => p.toLocaleLowerCase("tr-TR")),
      "hekim", "akredite", "uçtan uca", "e2ee", "dakika", "dk ", "yalnızca doktor", "ilgi alan",
      "%", "kat daha", "daha hızlı öğren",
    ];
    for (const b of banned) {
      const hit = lower.find((t) => t.includes(b));
      expect(hit, `yasak kalıp "${b}"`).toBeUndefined();
    }
    // Büyük/küçük duyarlı kurum kısaltmaları (kelime sınırı)
    for (const re of [/\bEMA\b/, /\bTİTCK\b/, /\bTITCK\b/]) {
      expect(texts.find((t) => re.test(t)), String(re)).toBeUndefined();
    }
  });

  it("hero'da AI/platform/network/portal kelimeleri yok (belge §1 hero kararı)", () => {
    const hero = SECTIONS.find((s) => s.id === "hero")!;
    const text = [hero.title, hero.eyebrow, hero.lead, hero.note, ...(hero.ctas?.map((c) => c.label) ?? [])].join(" ").toLocaleLowerCase("tr-TR");
    for (const w of ["yapay zek", " ai ", "platform", "network", "portal"]) expect(text.includes(w), w).toBe(false);
  });

  it("nav çapalarının hepsi bir bölüme bağlı; CTA hedefleri rota anahtarı ya da mevcut çapa", () => {
    const anchors = new Set(SECTIONS.map((s) => s.anchor).filter(Boolean));
    for (const a of LANDING_ANCHORS) expect(anchors.has(a.id), a.id).toBe(true);
    for (const s of SECTIONS) {
      for (const c of s.ctas ?? []) {
        if (c.to.startsWith("#")) expect(anchors.has(c.to.slice(1)), `${s.id} → ${c.to}`).toBe(true);
        else expect(c.to in LANDING_ROUTES, `${s.id} → ${c.to}`).toBe(true);
      }
    }
  });

  it("bölüm kimlikleri tekil, başlık boş değil, her bölümün teması tanımlı", () => {
    const ids = SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SECTIONS) {
      expect(s.title.length, s.id).toBeGreaterThan(0);
      expect(["dark", "deep", "light"]).toContain(s.theme);
    }
  });

  it("giriş CTA'sı Doctorium kapısına gider (hasta kapısına DEĞİL) ve portala döner", () => {
    expect(LANDING_ROUTES.login.startsWith("/doctorium/giris?next=/doktor/doctorium")).toBe(true);
  });
});

describe("taksonomi kopyası (istemci-güvenli) ↔ sunucu kaynağı", () => {
  it("bölüm anahtarları FEED_MODULE_OPTIONS ile BİREBİR (sıra dahil)", () => {
    expect(LANDING_MODULES.map((m) => m.key)).toEqual(FEED_MODULE_OPTIONS.map((m) => m.key));
    expect(LANDING_MODULES.map((m) => m.label)).toEqual(FEED_MODULE_OPTIONS.map((m) => m.label));
  });
  it("branşlar BRANCH_OPTIONS ile BİREBİR (35)", () => {
    expect(LANDING_BRANCHES).toEqual(BRANCH_OPTIONS);
    expect(LANDING_BRANCHES.length).toBe(35);
  });
  it("varsayılan demo seçimi geçerli", () => {
    expect(LANDING_BRANCHES.some((b) => b.slug === DEFAULT_DEMO_BRANCH)).toBe(true);
    for (const m of DEFAULT_DEMO_MODULES) expect(LANDING_MODULES.some((x) => x.key === m), m).toBe(true);
  });
});

describe("neden görüyorum (kuraldan türetilmiş)", () => {
  const label = (s: string) => s.toUpperCase();
  it("branş eşleşmesi → branş + bölüm", () => {
    const w = whyShown({ module: "akademik", branchSlugs: ["kardiyoloji"] }, ["kardiyoloji"], label);
    expect(w.rule).toBe("branch");
    expect(w.line).toContain("KARDIYOLOJI");
    expect(w.line).toContain("Akademik");
  });
  it("branşsız bölüm → bölüm tercihi", () => {
    expect(whyShown({ module: "ilac", branchSlugs: [] }, ["kardiyoloji"], label).rule).toBe("module");
  });
  it("hukuk alt türü etikette ayrışır", () => {
    expect(whyShown({ module: "mevzuat", kind: "ictihat", branchSlugs: [] } as never, [], label).line).toContain("İçtihat");
  });
});

describe("fixture dürüstlüğü", () => {
  it("örnek kartlar gerçek kaynak taklit etmez: url/doi yok, 'Örnek içerik' kaynak adı, ornek- id", () => {
    for (const f of FIXTURE_FEED) {
      expect(f.url).toBeNull();
      expect(f.doi).toBeNull();
      expect(f.sourceName).toBe("Örnek içerik");
      expect(f.id.startsWith("ornek-")).toBe(true);
      expect(f.authors).toBeNull();
    }
  });
});

describe("analytics sözlüğü", () => {
  it("belge §8 çekirdek olayları tanımlı; dışı reddedilir", () => {
    for (const n of ["landing_view", "create_doctorium_click", "personalization_demo_start", "personalization_demo_update", "original_source_click", "section_view"]) {
      expect(isLandingEventName(n), n).toBe(true);
    }
    expect(isLandingEventName("search_query")).toBe(false);
    expect(isLandingPlacement("hero")).toBe(true);
    expect(isLandingPlacement("kardiyoloji")).toBe(false); // branş adı placement OLAMAZ (ham tercih sızmasın)
    expect(LANDING_EVENT_NAMES.length).toBeGreaterThan(5);
  });
});
