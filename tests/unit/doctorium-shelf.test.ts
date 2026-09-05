// Doctorium üst rafı — kitleye göre sekme SÖZLEŞMESİ (üç katman Faz B1 → B3, 2026-09-05). nav.test.ts deseni: TAM liste
// `.toEqual([...])` — yanlışlıkla eklenen ya da düşen sekme burada kırılır. B3 kullanıcı kararı: raf HER KİTLEDE aynı,
// öğrenciye ekstra sekme AÇILMAZ (TUS + Kariyer EDU Kariyer'in içinde), Takvim en sonda.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { shelfTabsFor, MODULE_TABS, TAKVIM_TAB, SHELF_EMERALD, STUDENT_LANE } from "@/lib/doctorium-shelf";
import type { DoctoriumAudience } from "@/lib/doctorium-tiers";

const hrefs = (a: DoctoriumAudience | null) => shelfTabsFor(a).map((t) => t.href);
const BASE = [
  "/doktor/doctorium",
  "/doktor/doctorium?m=akademik",
  "/doktor/doctorium?m=sektorel",
  "/doktor/doctorium?m=ilac",
  "/doktor/doctorium?m=etkinlik",
  "/doktor/doctorium?m=kariyer",
  "/doktor/doctorium?m=mevzuat",
  "/doktor/doctorium/takvim",
];

describe("shelfTabsFor — TAM liste (B3: raf her kitlede aynı)", () => {
  it("VERIFIED · TRIAL · STUDENT · personel (null): 7 modül + Takvim (08, en sonda) — öğrenciye ekstra sekme AÇILMAZ", () => {
    for (const a of ["VERIFIED", "TRIAL", "STUDENT", null] as const) {
      expect(hrefs(a)).toEqual(BASE);
      expect(shelfTabsFor(a).at(-1)?.key).toBe("takvim");
    }
  });
  it("LOCKED/NONE rafa hiç ulaşmaz ama fonksiyon güvenli: doktor rafı döner", () => {
    expect(hrefs("LOCKED")).toEqual(BASE);
    expect(hrefs("NONE")).toEqual(BASE);
  });
  it("öğrencide YALNIZ Kariyer sekmesinin rengi değişir (öğrenci kulvarı koral); diğer sekmeler birebir", () => {
    const student = shelfTabsFor("STUDENT");
    const doctor = shelfTabsFor("VERIFIED");
    student.forEach((t, i) => {
      if (t.key === "kariyer") {
        expect(t.color).toEqual(STUDENT_LANE);
        expect(doctor[i].color).toEqual({ dark: "#60a5fa", light: "#2d5c9e" });
        expect({ ...t, color: doctor[i].color }).toEqual(doctor[i]);
      } else {
        expect(t).toEqual(doctor[i]);
      }
    });
  });
});

describe("sekme tanımları", () => {
  it("anahtarlar benzersiz; etiketlerde 'hekim' yok; modül sekmeleri DB module anahtarlarını taşır; TUS/Kariyer EDU rafta YOK", () => {
    const all = [...MODULE_TABS, TAKVIM_TAB];
    expect(new Set(all.map((t) => t.key)).size).toBe(all.length);
    for (const t of all) expect(t.label.toLocaleLowerCase("tr")).not.toContain("hekim");
    for (const t of MODULE_TABS) expect(t.module).toBe(t.key);
    expect(TAKVIM_TAB.module).toBeNull();
    expect(all.some((t) => /\/tus|kariyer-edu/.test(t.href))).toBe(false);
  });
  it("STUDENT_LANE koral çifti (👤 karar 2026-09-05, Faz B2); Takvim marka zümrüdünde", () => {
    expect(STUDENT_LANE).toEqual({ dark: "#fb923c", light: "#9a3412" });
    expect(TAKVIM_TAB.color).toEqual(SHELF_EMERALD);
  });
  it("globals.css: Doctorium kapsam aksanı ZÜMRÜT, öğrenci bloğu KORAL — TS ↔ CSS sözleşmesi", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    // Kapsam aksanı (tam koral yüzey, 2026-09-05): kit + eski Tailwind zümrüt sınıflarının yerine geçen token'lar.
    expect(css).toMatch(/\.doctorium-scope \{[^}]*--c-accent: #34d399;/);
    expect(css).toMatch(/\.theme-light \.doctorium-scope \{[^}]*--c-accent: #047857;/);
    const start = css.indexOf('.doctorium-scope[data-audience="student"]');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf("/* AÇIK RAF VARYANTI", start));
    expect(block).toContain(`--audience-accent: ${STUDENT_LANE.dark};`);
    expect(block).toContain("--audience-accent: #c2410c;");
    expect(block).toContain(`--shelf-pulse: ${STUDENT_LANE.light};`);
    // Header kromu daima theme-dark → gündüz değeri header'a yazılmaz (koyu kromda koyu koral AA altı kalırdı)
    expect(block).not.toContain('.theme-light header[data-audience="student"]');
  });
  it("küme ayracı yerleri: Akışım→Akademik, İlaç→Etkinlik, Hukuk→Takvim (Takvim'den sonra sekme yok)", () => {
    const tabs = shelfTabsFor("STUDENT");
    const seps = tabs.map((t, i) => (i > 0 && t.group !== tabs[i - 1].group ? t.key : null)).filter(Boolean);
    expect(seps).toEqual(["akademik", "etkinlik", "takvim"]);
  });
});
