// TUS REHBERLERİ (K3) + KAYNAKÇA / KURS DİZİNİ (K4) VERİ SÖZLEŞMESİ — 2026-09-05 👤 kararlar: rehber = YALNIZ resmî kılavuz
// özeti (yorum/strateji/tavsiye dili yok, her bölüm madde numaralı, kaynak ÖSYM); kurs/kaynakça = TARAFSIZ KÜNYE (fiyat/puan/
// sıralama/öneri/iddia yok, resmî site https, alfabetik); onaysız kayıt (approvedAt null) hiçbir seçicide görünmez. DB'siz saf modüller.
import { describe, it, expect } from "vitest";
import { TUS_GUIDES, approvedTusGuides, findApprovedTusGuide, TUS_GUIDE_DISCLAIMER, TUS_GUIDE_SOURCE } from "@/lib/tus-guides";
import {
  TUS_COURSE_PROVIDERS, TUS_RESOURCES, approvedCourseProviders, approvedResources, TUS_COURSE_FORMAT_LABEL, TUS_RESOURCE_KIND_LABEL,
} from "@/lib/tus-resources";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const host = (u: string) => new URL(u).hostname.replace(/^www\./, "");
// ⚖️ Terim kuralı "hekim" YOK — RESMÎ ADLAR istisna (CLAUDE.md): yönetmelik adı + "Aile Hekimliği" uzmanlık dalı kılavuzdan aktarım.
const OFFICIAL_NAMES = ["Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği", "Aile Hekimliği"];
const stripOfficial = (s: string) => OFFICIAL_NAMES.reduce((acc, n) => acc.split(n).join(" "), s);
const lower = (s: string) => s.toLocaleLowerCase("tr-TR");

describe("TUS rehberleri (K3) — resmî kılavuz özeti sözleşmesi", () => {
  const all = TUS_GUIDES.map((g) => ({ g, text: [g.title, g.summary, ...g.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.items ?? [])])].join("\n") }));

  it("≥ 6 rehber; slug benzersiz ve kebab-case; kaynak ÖSYM https + verifiedAt ISO", () => {
    expect(TUS_GUIDES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(TUS_GUIDES.map((g) => g.slug)).size).toBe(TUS_GUIDES.length);
    for (const g of TUS_GUIDES) {
      expect(g.slug, g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(g.sourceUrl.startsWith("https://")).toBe(true);
      expect(host(g.sourceUrl).endsWith("osym.gov.tr"), g.slug).toBe(true);
      expect(g.sourceLabel).toContain("ÖSYM");
      expect(g.verifiedAt).toMatch(ISO);
      expect(g.summary.length).toBeGreaterThan(30);
    }
    expect(host(TUS_GUIDE_SOURCE.url).endsWith("osym.gov.tr")).toBe(true);
  });

  it("her rehber ≥ 2 bölüm; her bölüm başlık + kılavuz madde referansı + en az bir paragraf; paragraflar kısa özet (≤ 900 karakter)", () => {
    for (const g of TUS_GUIDES) {
      expect(g.sections.length, g.slug).toBeGreaterThanOrEqual(2);
      for (const s of g.sections) {
        expect(s.heading.length).toBeGreaterThan(3);
        expect(s.ref, `${g.slug}/${s.heading}`).toMatch(/^\d+(\.\d+)?(-[a-zç])?( · \d+(\.\d+)?(-[a-zç])?)*$/u);
        expect(s.paragraphs.length, `${g.slug}/${s.heading}`).toBeGreaterThan(0);
        for (const p of [...s.paragraphs, ...(s.items ?? [])]) expect(p.length, `${g.slug}/${s.heading}`).toBeLessThanOrEqual(900);
      }
    }
  });

  it("dil: yorum/strateji/tavsiye yok; 'hekim' yalnız resmî adlarda", () => {
    // "kadro"/"atama" kılavuzun kendi hukuki terimidir (uzmanlık öğrencisi kadrosuna atama) — İŞKUR ilan dili DEĞİL, yasaklanmaz.
    const FORBIDDEN = ["tavsiye", "öneri", "strateji", "garanti", "bize göre", "en iyi", "hekim", "kesin kazan", "sizin için"];
    for (const { g, text } of all) {
      const t = lower(stripOfficial(text));
      for (const w of FORBIDDEN) expect(t.includes(w), `${g.slug}: "${w}"`).toBe(false);
    }
    expect(lower(TUS_GUIDE_DISCLAIMER)).toContain("bağlayıcı olan kılavuz metnidir");
  });

  it("onaysız rehber seçicilerde görünmez; onaylı olan slug ile bulunur", () => {
    const fx = [
      { ...TUS_GUIDES[0], slug: "a", approvedAt: "2026-09-05" },
      { ...TUS_GUIDES[0], slug: "b", approvedAt: null },
    ];
    expect(approvedTusGuides(fx).map((g) => g.slug)).toEqual(["a"]);
    expect(findApprovedTusGuide("a", fx)?.slug).toBe("a");
    expect(findApprovedTusGuide("b", fx)).toBeNull();
    expect(findApprovedTusGuide("yok", fx)).toBeNull();
    // Gerçek kayıt defteri: approvedAt ya null ya ISO gün.
    for (const g of TUS_GUIDES) if (g.approvedAt !== null) expect(g.approvedAt).toMatch(ISO);
  });
});

describe("Kaynakça + kurs dizini (K4) — tarafsız künye sözleşmesi", () => {
  // Kurumların KENDİ alan adları + resmî kaynaklar. Yeni kayıt = alan adı buraya, aksi hâlde kayıt alınmaz.
  const HOSTS = ["osym.gov.tr", "tuk.saglik.gov.tr", "resmigazete.gov.tr", "tusdata.com", "tusem.com.tr", "tusmer.com", "tustime.com", "klinisyen.com", "akademisyen.com"];
  const okHost = (h: string) => HOSTS.some((d) => h === d || h.endsWith("." + d));
  // Tanıtım/karşılaştırma/fiyat/öneri dili ve sponsor iması yok; "hekim" yalnız resmî adlarda.
  const FORBIDDEN = ["en iyi", "en büyük", "lider", "fiyat", "₺", " tl", "indirim", "kampanya", "tavsiye", "öneri", "sponsor", "garanti", "başarı", "hekim"];

  it("kurumlar: id benzersiz; resmî site https + bilinen alan adı; biçim etiketli; verifiedAt ISO; dil tarafsız", () => {
    expect(TUS_COURSE_PROVIDERS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(TUS_COURSE_PROVIDERS.map((c) => c.id)).size).toBe(TUS_COURSE_PROVIDERS.length);
    for (const c of TUS_COURSE_PROVIDERS) {
      expect(c.officialUrl.startsWith("https://"), c.id).toBe(true);
      expect(okHost(host(c.officialUrl)), `${c.id}: ${c.officialUrl}`).toBe(true);
      expect(TUS_COURSE_FORMAT_LABEL[c.format]).toBeTruthy();
      expect(c.verifiedAt).toMatch(ISO);
      expect(c.services.length).toBeGreaterThan(0);
      const t = lower(stripOfficial([c.name, ...c.services, ...(c.cities ?? [])].join(" ")));
      for (const w of FORBIDDEN) expect(t.includes(w), `${c.id}: "${w}"`).toBe(false);
    }
  });

  it("kaynaklar: id benzersiz; tür etiketli; https + bilinen alan adı; not ≤ 300 karakter; dil tarafsız", () => {
    expect(new Set(TUS_RESOURCES.map((r) => r.id)).size).toBe(TUS_RESOURCES.length);
    for (const r of TUS_RESOURCES) {
      expect(TUS_RESOURCE_KIND_LABEL[r.kind]).toBeTruthy();
      expect(r.officialUrl.startsWith("https://"), r.id).toBe(true);
      expect(okHost(host(r.officialUrl)), `${r.id}: ${r.officialUrl}`).toBe(true);
      expect(r.note.length, r.id).toBeLessThanOrEqual(300);
      expect(r.verifiedAt).toMatch(ISO);
      const t = lower(stripOfficial([r.name, r.organization ?? "", r.note].join(" ")));
      for (const w of FORBIDDEN) expect(t.includes(w), `${r.id}: "${w}"`).toBe(false);
    }
    // Resmî kaynaklar (kamu, ücretsiz) en az 3.
    expect(TUS_RESOURCES.filter((r) => r.kind === "resmi").length).toBeGreaterThanOrEqual(3);
  });

  it("seçiciler: onaysız görünmez; kurumlar Türkçe alfabetik; kaynaklarda resmî önce, sonra alfabetik", () => {
    const A = "2026-09-05";
    const cs = approvedCourseProviders([
      { ...TUS_COURSE_PROVIDERS[0], id: "z", name: "Zeta", approvedAt: A },
      { ...TUS_COURSE_PROVIDERS[0], id: "c", name: "Çınar", approvedAt: A },
      { ...TUS_COURSE_PROVIDERS[0], id: "b", name: "Beta", approvedAt: null },
      { ...TUS_COURSE_PROVIDERS[0], id: "a", name: "alfa", approvedAt: A },
    ]);
    expect(cs.map((c) => c.id)).toEqual(["a", "c", "z"]);
    const rs = approvedResources([
      { ...TUS_RESOURCES[0], id: "y1", kind: "yayinevi", name: "Beta Yayın", approvedAt: A },
      { ...TUS_RESOURCES[0], id: "r2", kind: "resmi", name: "Zeta Kurumu", approvedAt: A },
      { ...TUS_RESOURCES[0], id: "y0", kind: "kitabevi", name: "Alfa Kitabevi", approvedAt: A },
      { ...TUS_RESOURCES[0], id: "r1", kind: "resmi", name: "Alfa Kurumu", approvedAt: A },
      { ...TUS_RESOURCES[0], id: "x", kind: "yayinevi", name: "Gizli", approvedAt: null },
    ]);
    expect(rs.map((r) => r.id)).toEqual(["r1", "r2", "y0", "y1"]);
    for (const x of [...TUS_COURSE_PROVIDERS, ...TUS_RESOURCES]) if (x.approvedAt !== null) expect(x.approvedAt).toMatch(ISO);
  });
});
