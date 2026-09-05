// Doctorium üst rafı — kitleye göre sekme SÖZLEŞMESİ (üç katman Faz B1, 2026-09-05). nav.test.ts deseni: TAM liste
// `.toEqual([...])` — yanlışlıkla eklenen ya da düşen sekme burada kırılır.
import { describe, it, expect } from "vitest";
import { shelfTabsFor, MODULE_TABS, TAKVIM_TAB, TUS_TAB, KARIYER_EDU_TAB } from "@/lib/doctorium-shelf";
import type { DoctoriumAudience } from "@/lib/doctorium-tiers";

const hrefs = (a: DoctoriumAudience | null, showTus = false) => shelfTabsFor(a, { showTus }).map((t) => t.href);
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

describe("shelfTabsFor — TAM liste", () => {
  it("VERIFIED · TRIAL · personel (null): bugünkü raf — 7 modül + Takvim (08)", () => {
    expect(hrefs("VERIFIED")).toEqual(BASE);
    expect(hrefs("TRIAL")).toEqual(BASE);
    expect(hrefs(null)).toEqual(BASE);
    expect(shelfTabsFor("VERIFIED", { showTus: false })[7].key).toBe("takvim");
  });
  it("doktor 'TUS sekmesini göster' açarsa + TUS (09) — Kariyer EDU gelmez", () => {
    expect(hrefs("VERIFIED", true)).toEqual([...BASE, "/doktor/doctorium/tus"]);
    expect(hrefs("TRIAL", true)).toEqual([...BASE, "/doktor/doctorium/tus"]);
  });
  it("STUDENT: + TUS (09) + Kariyer EDU (10); tercih anahtarından bağımsız", () => {
    const expected = [...BASE, "/doktor/doctorium/tus", "/doktor/doctorium/kariyer-edu"];
    expect(hrefs("STUDENT")).toEqual(expected);
    expect(hrefs("STUDENT", true)).toEqual(expected);
  });
  it("LOCKED/NONE rafa hiç ulaşmaz ama fonksiyon güvenli: doktor rafı döner", () => {
    expect(hrefs("LOCKED")).toEqual(BASE);
    expect(hrefs("NONE")).toEqual(BASE);
  });
});

describe("sekme tanımları", () => {
  it("anahtarlar benzersiz; etiketlerde 'hekim' yok; modül sekmeleri DB module anahtarlarını taşır", () => {
    const all = [...MODULE_TABS, TAKVIM_TAB, TUS_TAB, KARIYER_EDU_TAB];
    expect(new Set(all.map((t) => t.key)).size).toBe(all.length);
    for (const t of all) expect(t.label.toLocaleLowerCase("tr")).not.toContain("hekim");
    for (const t of MODULE_TABS) expect(t.module).toBe(t.key);
    expect(TAKVIM_TAB.module).toBeNull();
    expect(TUS_TAB.group).toBe("EDU");
    expect(KARIYER_EDU_TAB.group).toBe("EDU");
  });
  it("küme ayracı yerleri değişmedi: Akışım→Akademik, İlaç→Etkinlik, Hukuk→Takvim, Takvim→TUS", () => {
    const tabs = shelfTabsFor("STUDENT", { showTus: false });
    const seps = tabs.map((t, i) => (i > 0 && t.group !== tabs[i - 1].group ? t.key : null)).filter(Boolean);
    expect(seps).toEqual(["akademik", "etkinlik", "takvim", "tus"]);
  });
});
